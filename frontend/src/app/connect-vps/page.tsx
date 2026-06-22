import { redirect } from 'next/navigation';

export default function ConnectVpsRedirect() {
  redirect('/account?tab=vps');
}
