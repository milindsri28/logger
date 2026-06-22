import { redirect } from 'next/navigation';

export default function VpsRedirect() {
  redirect('/account?tab=vps');
}
