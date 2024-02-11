const pg = require('pg');

const URL = process.env.DB_URL || 'postgres://postgres:12345678@localhost:5432/postgres';
// const URL = process.env.DB_URL || 'postgres://postgres:12345678@postgres_db:5432/postgres';
// const URL = process.env.DB_URL || 'mongodb://localhost:27017';

const pool = new pg.Pool({
    connectionString: URL,
    max: (Number(process.env.DB_POOL) || 200),
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000
});

pool.on('error', connect);

pool.once('connect', () => {
    console.log(`database.js: Connected  to db ${URL}`);
    console.log(`Creating table "pessoas" if not exists`);
    return pool.query(`
        CREATE EXTENSION IF NOT EXISTS pg_trgm;

        CREATE OR REPLACE FUNCTION generate_searchable(_nome VARCHAR, _apelido VARCHAR, _stack JSON)
            RETURNS TEXT AS $$
            BEGIN
            RETURN _nome || _apelido || _stack;
            END;
        $$ LANGUAGE plpgsql IMMUTABLE;

        CREATE TABLE IF NOT EXISTS pessoas (
            id uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
            apelido TEXT UNIQUE NOT NULL,
            nome TEXT NOT NULL,
            nascimento DATE NOT NULL,
            stack JSON,
            searchable text GENERATED ALWAYS AS (generate_searchable(nome, apelido, stack)) STORED
        );

        CREATE INDEX IF NOT EXISTS idx_pessoas_searchable ON public.pessoas USING gist (searchable public.gist_trgm_ops (siglen='64'));

        CREATE UNIQUE INDEX IF NOT EXISTS pessoas_apelido_index ON public.pessoas USING btree (apelido);
        `);
});

async function connect() {
    try {
        console.log(`Connecting to db ${URL}`);
        await pool.connect();
    } catch (err) {
        setTimeout(() => {
            connect();
            console.log(`database.js: an error occured when connecting ${err} retrying connection on 3 secs`);
        }, 3000);
    }
}

connect();

module.exports.insertTransaction = async function (id, valor, descricao, tipo) {
    const query = `
    INSERT INTO
     pessoas(
        id,
        valor,
        descricao,
        tipo
     )
    VALUES (
        $1,
        $2,
        $3,
        $4
    )
    `;
    return pool.query(query, [id, valor, descricao, tipo]);
};

module.exports.findById = async function findById(id) {
    const query = `
    SELECT
        id,
        apelido,
        nome,
        to_char(nascimento, 'YYYY-MM-DD') as nascimento,
        stack
    FROM
        pessoas
    WHERE "id" = $1;
    `;
    return pool.query(query, [id]);
};

module.exports.findByTerm = async function findByTerm(term) {
    const query = `
    SELECT
        id,
        apelido,
        nome,
        to_char(nascimento, 'YYYY-MM-DD') as nascimento,
        stack
    FROM
        pessoas
    WHERE
        searchable ILIKE $1
    LIMIT 50;`;
    return pool.query(query, [`%${term}%`]);
};

module.exports.existsByApelido = async function existsByApelido(apelido) {
    const querySet = await pool.query(`SELECT COUNT(1) FROM pessoas WHERE "apelido" = $1`, [apelido]);
    const [result] = querySet.rows;
    return result;
};

module.exports.count = async function count() {
    return pool.query(`SELECT COUNT(1) FROM pessoas`);
};

const LOG_TRESHOLD = Number(process.env.LOG_TRESHOLD) || 3000;

process.env.SLOW_QUERY_ALERT === 'true' ? (() => {
    Object.keys(module.exports).forEach((mK) => {
        const fn = module.exports[mK];

        async function newApi() {
            const timestamp = Date.now();
            const result = await fn(...arguments);
            const final = Date.now();
            const delta = final - timestamp;
            if (delta >= LOG_TRESHOLD) {
                console.log(`Query took ${delta}ms for fn ${fn.name}`);
            }
            return result;
        }

        module.exports[mK] = newApi.bind(module.exports);
    });
})() : null;