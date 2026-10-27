import { redirect } from 'next/navigation';

// Sign-in links create the account on first use, so there is no separate sign-up.
export default function SignUp() {
  redirect('/auth/signin');
}
