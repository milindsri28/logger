import { redirect } from 'next/navigation';

export default function IncidentsRedirect() {
  redirect('/account?tab=history');
}
