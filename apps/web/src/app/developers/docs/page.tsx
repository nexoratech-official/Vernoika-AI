import Link from "next/link";

const requestExample = `curl https://YOUR_VORNOKIA_ORIGIN/api/v1/chat/completions ^
  -H "Authorization: Bearer vno_live_YOUR_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\\"model\\":\\"vornokia-prime\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Hello, Vornokia\\"}]}"`;

const sdkExample = `import { Vornokia } from "@vornokia/sdk";

const vornokia = new Vornokia({ apiKey: process.env.VORNOKIA_API_KEY! });
const completion = await vornokia.chat.completions.create({
  messages: [{ role: "user", content: "Hello, Vornokia" }],
});

console.log(completion.choices[0].message.content);`;

export default function DeveloperDocsPage() {
  return (
    <main className="api-docs">
      <header className="api-docs-header">
        <Link href="/" className="api-docs-brand">VORNOKIA <span>DEVELOPERS</span></Link>
        <Link className="button button-secondary" href="/app/developers">Developer dashboard</Link>
      </header>
      <article className="api-docs-content">
        <div className="eyebrow"><span /> API REFERENCE</div>
        <h1>Build with Vornokia</h1>
        <p className="api-docs-lead">Use a scoped API key to request Vornokia Prime chat completions from a trusted server or application backend.</p>

        <section>
          <h2>Authentication</h2>
          <p>Create an application and API key in the <Link href="/app/developers">developer dashboard</Link>. Keys are shown once; store them in a server-side secret manager or environment variable. Do not ship them in browser or mobile application bundles.</p>
          <pre><code>Authorization: Bearer vno_live_…</code></pre>
        </section>

        <section>
          <h2>Chat completions</h2>
          <div className="api-docs-endpoint"><span>POST</span><code>/api/v1/chat/completions</code></div>
          <p>The endpoint accepts up to 20 text messages. Message roles are <code>user</code> and <code>assistant</code>; Vornokia Prime supplies its own system instructions. Each message is limited to 4,000 characters, with a 20,000-character total context limit.</p>
          <pre><code>{requestExample}</code></pre>
          <h3>Request fields</h3>
          <ul>
            <li><code>messages</code> — required array of user and assistant messages; at least one user message is required.</li>
            <li><code>model</code> — optional; the supported identifier is <code>vornokia-prime</code>.</li>
            <li><code>stream</code> — optional boolean; set to <code>true</code> for server-sent event chunks.</li>
          </ul>
          <h3>TypeScript SDK</h3>
          <p>The source SDK is in <code>packages/sdk</code> and uses the same API key from a server-side environment variable.</p>
          <pre><code>{sdkExample}</code></pre>
        </section>

        <section>
          <h2>Limits and usage</h2>
          <ul>
            <li>Each key is limited to 10 requests per minute and 10,000 requests per calendar month.</li>
            <li>Each application can have up to five active keys. Revoke a key immediately from the dashboard if it is exposed.</li>
            <li>Limits apply per key. The initial developer tier meters requests and model-reported tokens; it does not charge money.</li>
            <li>Requests use the configured Vornokia model gateway. Provider availability and provider usage policies still apply.</li>
          </ul>
        </section>

        <section>
          <h2>Errors</h2>
          <p>Errors use an OpenAI-style JSON envelope with <code>error.message</code> and <code>error.code</code>. Common HTTP statuses include 400 for invalid input, 401 for a missing or revoked key, 403 for insufficient scope, 429 for a limit, 502 for provider errors, and 503 for unavailable configuration.</p>
        </section>

        <section>
          <h2>Data handling</h2>
          <p>API prompt and response content is not saved as a Vornokia conversation. The service records request status and provider-reported token counts for usage metering. API keys are stored as SHA-256 hashes and cannot be recovered in plaintext.</p>
        </section>
      </article>
    </main>
  );
}
