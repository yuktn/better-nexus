import { api } from "./api.js";
import { admin } from "./admin.js";
import { initDb } from "./db.js";

await initDb();

api.listen(8081, "0.0.0.0", () => {
    console.log("api listening on :8081");
});

admin.listen(8082, "127.0.0.1", () => {
    console.log("admin api listnening on :8082");
});