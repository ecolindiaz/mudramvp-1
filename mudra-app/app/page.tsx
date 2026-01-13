import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to login - authenticated users will be redirected to dashboard by middleware
  redirect('/login')
}
