-- UNHCR displacement data: people hosted (by country of asylum), one row
-- per host country per year. Complements the World Bank economic
-- indicators with the displacement-affected population the program serves.

CREATE TABLE IF NOT EXISTS refugee_statistics (
    id                  BIGSERIAL PRIMARY KEY,
    country_iso3        TEXT NOT NULL,
    year                INTEGER NOT NULL,
    refugees            BIGINT,
    asylum_seekers      BIGINT,
    returned_refugees   BIGINT,
    idps                BIGINT,
    returned_idps       BIGINT,
    stateless           BIGINT,
    others_of_concern   BIGINT,
    host_community      BIGINT,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country_iso3, year)
);

CREATE INDEX IF NOT EXISTS idx_refugee_statistics_country
    ON refugee_statistics (country_iso3);

ALTER TABLE refugee_statistics REPLICA IDENTITY DEFAULT;
