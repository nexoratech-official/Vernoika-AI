# Vornokia TypeScript SDK

The SDK provides typed access to Vornokia's server-side chat-completions API.

```ts
import { Vornokia } from "@vornokia/sdk";

const vornokia = new Vornokia({
  apiKey: process.env.VORNOKIA_API_KEY!,
  baseURL: process.env.VORNOKIA_API_BASE_URL!,
});

const completion = await vornokia.chat.completions.create({
  messages: [{ role: "user", content: "Hello, Vornokia" }],
});

console.log(completion.choices[0].message.content);
```

Set `baseURL` to the origin of the Vornokia deployment. Keep the API key in a server-side secret store; never bundle it into a browser or mobile client. For streaming responses, pass `stream: true` and iterate over the returned chunks with `for await`.

The package source is under active development and is not yet published to a package registry. Build it with `npm run build` after installing its TypeScript development dependency.
