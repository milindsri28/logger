import { redirect } from 'next/navigation';

export default function ConnectGitHubRedirect() {
  redirect('/integrations');
}
