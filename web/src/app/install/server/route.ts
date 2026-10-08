export function GET() {
  return Response.redirect(
    "https://raw.githubusercontent.com/yuktn/better-nexus/v0.1.2/scripts/install-server.sh",
    302,
  );
}