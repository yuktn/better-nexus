import { api } from "./api.js";
import { admin } from "./admin.js";
import { initDb } from "./db.js";
import { statusManager } from "./statusManager.js";
import { apiPort, cliPort } from "./config.js";

await initDb();

api.listen(apiPort, "0.0.0.0", () => {
    console.log(`api listening on :${apiPort}`);
});

admin.listen(cliPort, "127.0.0.1", () => {
    console.log(`admin api listening on :${cliPort}`);
});

setInterval(() => {
    void statusManager.intervalCheckup();
}, 5_000);
