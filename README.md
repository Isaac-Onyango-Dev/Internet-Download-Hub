# Browser Download Hub

A simple, local-first web interface for downloading media using `yt-dlp`.

## Development setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### Troubleshooting Port Conflicts

If you see an error like `EADDRINUSE: address already in use :::5005` or `:::5173` when starting the server, run the following command to cleanly kill any hanging background processes holding the ports open:

```bash
npm run stop
```

Then try `npm run dev` again. The `predev` script attempts to automatically kill port `5005` if it's occupied by another node process, but `npm run stop` is the manual override guarantee.
