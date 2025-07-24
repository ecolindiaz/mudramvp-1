import { redirect } from 'next/navigation'

export default function Home() {
  // For now, redirect to dashboard - you can change this to a landing page later
  redirect('/dashboard')
}
