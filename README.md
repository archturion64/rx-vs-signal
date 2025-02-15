# Demo rxJS vs. Signals in Angular 19.1

## Prerequisite

node version 22.x


To install dependencies:

```sh
npm ci
```

Create a file in the package.json folder called ".env".

It should specify the following 3 variables out of your Supabase project:

```
DATABASE_URL="postgresql://postgres.<add me>:<add me>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
VITE_SUPABASE_URL="https://<add me>.supabase.co"
VITE_SUPABASE_KEY="<add me>"
```

In your Supabase DB editor run:

``` sql
create sequence note_id_seq;

create table note (
    id bigint not null default nextval('note_id_seq'::regclass),
    note text not null,
    person text not null,
    created_at timestamp with time zone null default current_timestamp,
    constraint notes_pkey primary key (id)
);
```

## Run tasks

To start dev server:

```sh
npm run dev
```

To build for prod and run:

```sh
npm run prod
```

