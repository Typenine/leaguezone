import importlib.util
import io
import json
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
        self.assertEqual(len(uploads),4)
        for year in catalog["years"]:
            info=catalog["files"][str(year)]
            self.assertTrue(info["key"].startswith("research/v1/objects/"+str(year)+"-"))
            self.assertEqual(len(info["sha256"]),64)

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
        old["years"].append(2027)
        with self.assertRaisesRegex(ValueError,"Season history regression"):
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
