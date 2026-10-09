import importlib.util
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "research_publisher", REPO / "scripts" / "publish-public-research-r2.py"
)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class FakeR2:
    def __init__(self):
        self.files = {}
        self.ops = []

    def put_object(self, *, Bucket, Key, Body, **metadata):
        self.ops.append(("put",Key))
        self.files[Key]=Body

    def head_object(self, *, Bucket, Key):
        return {"ContentLength":len(self.files[Key])}

    def get_object(self, *, Bucket, Key):
        if Key not in self.files:
            raise AssertionError("Missing object")
        return {"Body":io.BytesIO(self.files[Key])}


class ResearchPublisherTests(unittest.TestCase):
    def setUp(self):
        self.data=REPO / "public" / "research" / "data"

    def test_manifest_versions_all_historical_seasons(self):
        catalog, uploads=publisher.build_catalog(self.data)
        self.assertEqual(catalog["schema"],1)
        self.assertEqual(catalog["years"],[2023,2024,2025,2026])
        self.assertEqual(len(uploads),12)
        self.assertEqual(set(catalog['datasets']), {'usage', 'redzone'})
        for kind in ('usage','redzone'):
            self.assertEqual(catalog['datasets'][kind]['years'],[2023,2024,2025,2026])
        for year in catalog["years"]:
            info=catalog["files"][str(year)]
            self.assertTrue(info["key"].startswith("research/v1/objects/"+str(year)+"-"))
            self.assertEqual(len(info["sha256"]),64)

    def test_mismatched_advanced_week_rejects_the_whole_refresh(self):
        with tempfile.TemporaryDirectory() as temp:
            from shutil import copytree
            # Only the index and current snapshots need to be reconstructed.
            root=Path(temp)
            for p in self.data.glob("20[0-9][0-9].json"):
                (root / p.name).write_bytes(p.read_bytes())
            (root / "seasons.json").write_bytes((self.data / "seasons.json").read_bytes())
            for kind in ("usage","redzone"):
                copytree(self.data / kind, root / kind)
            path=root / "usage" / "2026.json"
            broken=json.loads(path.read_text())
            broken["throughWeek"]=broken["throughWeek"]-1
            path.write_text(json.dumps(broken))
            with self.assertRaisesRegex(ValueError,"usage 2026 does not match"):
                publisher.build_catalog(root)

    def test_archived_advanced_data_is_preserved_for_future_seasons(self):
        old,_=publisher.build_catalog(self.data)
        year=2027
        info={"key":"research/v1/objects/2027-"+"a"*64,"sha256":"a"*64,
              "throughWeek":18,"updated":"2028-01-01","baseUpdated":"2028-01-01"}
        old["years"].append(year)
        old["files"][str(year)]=dict(info)
        for kind in ("usage","redzone"):
            old["datasets"][kind]["years"].append(year)
            old["datasets"][kind]["files"][str(year)]=dict(info)
        new, uploads=publisher.build_catalog(self.data,old)
        self.assertEqual(uploads,[])
        self.assertEqual(new,old)

    def test_advanced_metadata_is_part_of_atomic_catalog(self):
        catalog,uploads=publisher.build_catalog(self.data)
        self.assertEqual(len(uploads),12)
        base=catalog["files"]
        for kind in ("usage","redzone"):
            group=catalog["datasets"][kind]
            for year in group["years"]:
                info=group["files"][str(year)]
                self.assertEqual(info["throughWeek"],base[str(year)]["throughWeek"])
                self.assertEqual(info["baseUpdated"],base[str(year)]["updated"])
                self.assertRegex(info["key"],r"^research/v1/objects/20\d\d-[a-f0-9]{64}\.json$")

    def test_no_upload_for_identical_rebuilt_data(self):
        old, _ = publisher.build_catalog(self.data)
        new, uploads=publisher.build_catalog(self.data,old)
        self.assertEqual(new,old)
        self.assertEqual(uploads,[])

    def test_refresh_timestamp_does_not_trigger_upload(self):
        d=json.loads((self.data/"2026.json").read_text())
        newer=dict(d,updated="2040-01-01")
        self.assertEqual(publisher.digest(d),publisher.digest(newer))

    def test_historical_files_never_disappear_from_catalog(self):
        old,_=publisher.build_catalog(self.data)
        # In September 2028, a 2027 snapshot exists only in R2 because
        # GitHub Action datasets are not committed to the repository.
        archived_key="research/v1/objects/2027-"+"a"*64+".json"
        old["years"].append(2027)
        old["files"]["2027"]={
            "key":archived_key,"sha256":"a"*64,
            "throughWeek":18,"updated":"2028-01-15"
        }
        new, uploads=publisher.build_catalog(self.data,old)
        self.assertIn(2027,new["years"])
        self.assertEqual(new["files"]["2027"],old["files"]["2027"])
        self.assertEqual(uploads,[])

    def test_prevents_archived_season_week_regression(self):
        old,_=publisher.build_catalog(self.data)
        old["files"]["2026"]["throughWeek"]=10
        with self.assertRaisesRegex(ValueError,"Refusing to regress archived 2026"):
            publisher.build_catalog(self.data,old)

    def test_publish_atomic_pointer_last_and_noop_idempotent(self):
        catalog, uploads=publisher.build_catalog(self.data)
        fake=FakeR2()
        with patch.object(publisher,"public_check",return_value=b"ok") as check:
            self.assertTrue(publisher.publish(fake,"research-public",
                                             "https://data.example.com",
                                             catalog,uploads,None))
            self.assertEqual(fake.ops[-1],("put",publisher.CATALOG_KEY))
            self.assertEqual(check.call_count,len(uploads))
            self.assertFalse(publisher.publish(fake,"research-public",
                                              "https://data.example.com",
                                              catalog,[],catalog))
        self.assertEqual(len(fake.ops),len(uploads)+1)

    def test_worker_403_bypass_requires_explicit_setting_and_s3_verification(self):
        catalog, uploads = publisher.build_catalog(self.data)
        fake = FakeR2()
        with patch.object(publisher, "public_check",
                          side_effect=publisher.PublicWorkerBlocked("Cloudflare 403")):
            with self.assertRaises(publisher.PublicWorkerBlocked):
                publisher.publish(fake, "research-public",
                                  "https://example.workers.dev", catalog, uploads, None)
        self.assertNotIn(publisher.CATALOG_KEY, fake.files)
        with patch.dict(os.environ, {"RESEARCH_R2_ALLOW_CLOUDFLARE_403": "true"}):
            with patch.object(publisher, "public_check",
                              side_effect=publisher.PublicWorkerBlocked("Cloudflare 403")):
                self.assertTrue(publisher.publish(fake, "research-public",
                                "https://example.workers.dev", catalog, uploads, None))
        self.assertIn(publisher.CATALOG_KEY, fake.files)

    def test_corrupt_r2_readback_always_aborts_even_when_worker_403_allowed(self):
        catalog, uploads = publisher.build_catalog(self.data)
        class CorruptR2(FakeR2):
            def get_object(self, *, Bucket, Key):
                response = super().get_object(Bucket=Bucket, Key=Key)
                if Key.endswith(".json") and Key != publisher.CATALOG_KEY:
                    payload = json.loads(response["Body"].read())
                    payload["players"][0]["p"] = -9999
                    return {"Body": io.BytesIO(json.dumps(payload).encode())}
                return response
        fake = CorruptR2()
        with patch.dict(os.environ, {"RESEARCH_R2_ALLOW_CLOUDFLARE_403": "true"}):
            with patch.object(publisher, "public_check",
                              side_effect=publisher.PublicWorkerBlocked("Cloudflare 403")):
                with self.assertRaisesRegex(RuntimeError, "SHA-256"):
                    publisher.publish(fake, "research-public",
                                      "https://example.workers.dev", catalog, uploads, None)
        self.assertNotIn(publisher.CATALOG_KEY, fake.files)

    def test_non_bot_public_error_is_never_ignored(self):
        catalog, uploads = publisher.build_catalog(self.data)
        fake = FakeR2()
        with patch.dict(os.environ, {"RESEARCH_R2_ALLOW_CLOUDFLARE_403": "true"}):
            with patch.object(publisher, "public_check",
                              side_effect=RuntimeError("Public read 404")):
                with self.assertRaisesRegex(RuntimeError, "404"):
                    publisher.publish(fake, "research-public",
                                      "https://example.workers.dev", catalog, uploads, None)
        self.assertNotIn(publisher.CATALOG_KEY, fake.files)

    def test_first_file_upload_failure_does_not_publish_pointer(self):
        catalog,uploads=publisher.build_catalog(self.data)
        class BrokenR2(FakeR2):
            def head_object(self, *, Bucket, Key):
                raise RuntimeError("object not persisted")
        r2=BrokenR2()
        with self.assertRaisesRegex(RuntimeError,"object not persisted"):
            publisher.publish(r2,"bucket","https://data.example.com",catalog,uploads,None)
        self.assertNotIn(publisher.CATALOG_KEY,r2.files)


if __name__=="__main__":
    unittest.main()
