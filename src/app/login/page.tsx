import { Suspense } from "react"
import { Card } from "@/components/ui/card"
import { safeNextPath } from "@/lib/auth/auth-core"
import { LoginForm } from "./login-form"

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams
  return <LoginForm next={safeNextPath(Array.isArray(next) ? next[0] : next)} />
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="m-auto w-full max-w-sm px-4">
      <title>Sign in · Tradelog</title>
      <Card className="gap-6 p-6">
        <div className="text-center text-lg font-semibold tracking-[0.2em]">TRADELOG</div>
        <Suspense fallback={null}>
          <Login searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </main>
  )
}
