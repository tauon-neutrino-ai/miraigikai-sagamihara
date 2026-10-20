// 要約は Claude Code（`claude -p`）を呼び出して行う。
// claude.ai のサブスクリプションでログインした Claude Code を使うので、API キーや API の従量課金は使わない。
// 事前に `claude` を一度起動して /login しておくこと。
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

/** サブスクの利用上限に達したときのエラー。取り込みを止めるために区別する */
export class UsageLimitError extends Error {}

function runClaude(args: string[], input: string): Promise<string> {
  // API キーが環境にあると Claude Code がそちらで課金してしまうので、必ず外す
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { env, cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(new Error(`claude コマンドを起動できません（Claude Code は入っていますか？）: ${e.message}`)));
    child.on("close", (code) => {
      if (code === 0 || out.trim().startsWith("{")) resolve(out);
      else reject(new Error(`claude が終了コード ${code} で終了しました: ${(err || out).slice(0, 500)}`));
    });
    child.stdin.end(input);
  });
}

/** Claude Code に JSON スキーマ付きで依頼し、スキーマに沿った結果を返す */
export async function generateStructured<T extends z.ZodType>(opts: {
  system: string;
  prompt: string;
  schema: T;
}): Promise<z.infer<T>> {
  const args = [
    "-p",
    "--model", MODEL,
    "--output-format", "json",
    "--json-schema", JSON.stringify(jsonSchema(opts.schema)),
    "--system-prompt", opts.system,
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
  ];
  const raw = await runClaude(args, opts.prompt);
  let res: {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
    api_error_status?: number | null;
    usage?: Usage;
  };
  try {
    res = JSON.parse(raw);
  } catch {
    throw new Error(`claude の出力を読めませんでした: ${raw.slice(0, 300)}`);
  }
  if (res.is_error || res.structured_output == null) {
    const msg = String(res.result ?? "");
    if (res.api_error_status === 429 || /limit|上限|usage/i.test(msg)) {
      throw new UsageLimitError(`Claude の利用上限に達しました。時間をおいて再実行してください（${msg.slice(0, 200)}）`);
    }
    throw new Error(`claude がエラーを返しました: ${msg.slice(0, 300)}`);
  }
  if (res.usage) lastUsage = res.usage;
  return opts.schema.parse(res.structured_output);
}

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/** 直前の呼び出しで使ったトークン数（--preview で表示する） */
export let lastUsage: Usage | null = null;

/** Claude Code は $schema 付きの JSON Schema を受け付けないので外す */
function jsonSchema(schema: z.ZodType) {
  const out = z.toJSONSchema(schema) as Record<string, unknown>;
  delete out.$schema;
  return out;
}
