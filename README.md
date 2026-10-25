# Substitution Assistant Anni – research prototype

Internal web application that helps online grocery order pickers find a suitable
substitute for an unavailable product. Mandatory company rules are applied in code,
then the eligible alternatives are ranked (by Claude when an API key is configured,
otherwise by the rule-based preference score). Every decision is logged with the
costs calculated by the application.

Sections: **Find a substitute**, **Substitution rules**, **Decision log**, plus an
authenticated **Researcher** dashboard for importing data, managing versions and
exporting the decision log as CSV.

## Stack

Next.js (App Router, TypeScript), Tailwind CSS, shadcn-style components (Radix UI,
lucide-react), Prisma + PostgreSQL, Anthropic SDK.

## Environment variables (Railway → Variables)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Railway PostgreSQL connection string |
| `RESEARCHER_PASSWORD` | yes | Password for `/researcher` |
| `AUTH_SECRET` | recommended | Signs the researcher session cookie |
| `ANTHROPIC_API_KEY` | optional | Enables AI ranking; without it ranking is rule-based |
| `ANTHROPIC_MODEL` | optional | Defaults to `claude-opus-5-5` |

See `.env.example`. Never commit `.env`.

## Deployment

Railway builds from the `main` branch. `npm run build` runs `prisma generate && next build`;
`npm start` runs `prisma migrate deploy`, the idempotent seed (imports the sample
dataset and rules from `data/` only when the database is empty) and `next start`.
The server listens on `PORT`.

## Input files

- `data/products.csv` – product code, name, category, package quantity and unit, price,
  ingredients, attributes (JSON object), source URL, collection date, availability.
  The bundled file is a **sample with fictional prices**; decisions made with it are
  flagged as mock and excluded from exports.
- `data/substitution_rules.json` – mandatory requirements, permitted quantity and price
  differences, and preferences.

Both can be re-imported from the researcher dashboard; each import creates a new
immutable version and every decision records the versions it was made with.
