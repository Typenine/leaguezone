import { Suspense } from 'react';
import ResetPasswordContent from './ResetPasswordContent';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <Suspense>
      <ResetPasswordContent token={token} />
    </Suspense>
  );
}
