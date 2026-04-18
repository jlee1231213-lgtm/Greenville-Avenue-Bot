# Greenville Avenue Discord Bot

## How to Start the Bot

1. **Open a terminal.**
2. **Navigate to the bot's main directory:**

   ```sh
   cd <your-folder>/<bot-folder>
   ```
   (You should see `index.js`, `models/`, `commands/`, etc. in this folder.)

3. **Start the bot:**

   ```sh
   node index.js
   ```

**Do NOT run `node <folder>/index.js` from the parent folder.**

- All commands and models use relative paths that require the working directory to be the folder containing `index.js`.
- If you see errors like `Cannot find module '../../models/settings'`, you are in the wrong directory.

---

## Troubleshooting
- Make sure your `.env` file is present and contains a valid `TOKEN` and `MONGODB_URI`.
- If you add new commands or models, always run the bot from the correct directory.
- If you still have issues, delete any duplicate folders or files outside the main bot directory.
