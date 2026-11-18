import { createInterface } from "node:readline/promises"

/** A question answered in the terminal. */
export async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

/** A question whose answer is not echoed (a password). Ctrl+C stops the agent. */
export function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding("utf8")
    let answer = ""
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          process.stdout.write("\n")
          process.kill(process.pid, "SIGINT")
        } else if (char === "\r" || char === "\n") {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off("data", onData)
          process.stdout.write("\n")
          resolve(answer)
          return
        } else if (char === "\u007f" || char === "\b") {
          answer = answer.slice(0, -1)
        } else {
          answer += char
        }
      }
    }
    stdin.on("data", onData)
  })
}

export const canPrompt = () => Boolean(process.stdin.isTTY && process.stdout.isTTY)
