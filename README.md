# better-nexus

<p align="center">
  <img src="./docs/nexus-plus-logo.svg" alt="better nexus logo" width="400">
</p>

## Release 0.1.0 is live!

Visit [better nexus](https://nexus.yuktn.dev) to see better-nexus in action!

better-nexus is an enhanced version of [nexus](https://github.com/yuktn/nexus), and is a easily hostable and extendable device status monitoring project written in TypeScript.  

For v0.1.0, only linux is supported. Mac and Windows is to be expected in v0.2.0 if things go as planned.

For a tutorial on setting it up on your own server, check [Run locally](https://github.com/yuktn/better-nexus#run-locally).

Originally, nexus was planned to be a project for everyone to use, but was scrapped due to the volume of the project exceeding my skills. [legacynexus](https://github.com/yuktn/legacynexus)  
While the original nexus did support self hosting, it is a tedious task, and I consider it to not being made *for* self hosting purposes.

After learning and gaining more experience, I am trying to tackle this project once more in the right way this time, hopefully.

## Run locally

## Server, Web

### Prerequisites
`node`,`mongodb`, Any OTP Provider

The server and web is installed in the same folder and is run in the same file.  

Run:

```bash
curl -fsSL https://nexus.yuktn.com/install/server | sudo bash
```

Follow the instructions, and you're done!  

## Agent

### Prerequisites
`node`

Run:

```bash
curl -fsSL https://nexus.yuktn.com/install/agent | sudo bash
```

Follow the instructions, and you're done!  


## AI Usage

There was minimal use of AI in the backend (server/agent). All the logic, types, zod, db configuration was done by myself.  

The frontend was designed by myself, but the implementation had substantial use of AI.  

Linux installation script was assisted by AI.