import { redirect } from 'next/navigation';

export default function ConnectGitHubRedirect() {
  redirect('/account?tab=github');
}
