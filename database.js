const pg = require('pg');

const URL = process.env.DB_URL || 'postgres://postgres:12345678@localhost:5432/postgres';

const pool = new pg.Pool({
    connectionString: URL,
    max: (Number(process.env.DB_POOL) || 200),
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000
});

pool.on('error', connect);

const client = async function connect() {
    try {
        const client = await pool.connect();
        console.log(`Connected to db ${URL}`);
        return client;
    } catch (err) {
        console.error(`Error connecting to db: ${err}`);
        setTimeout(connect, 3000); // Retry connection after 3 seconds
    }
};

connect();

module.exports.insertTransaction = async function (account_id, amount, description, transaction_type) {
    try {
        await client.query('BEGIN');

        const updateBalanceQuery = `
            WITH updated_balance AS (
                UPDATE balances
                SET amount = amount + $1
                WHERE account_id = $2
                RETURNING amount
            ), inserted_transaction AS (
                INSERT INTO transactions (account_id, amount, description, transaction_type)
                VALUES ($2, $3, $4, $5)
                RETURNING id
            )
            SELECT ub.amount AS saldo, a.limit_amount AS limite
            FROM updated_balance ub
            JOIN accounts a ON a.id = $2
        `;

        const adjustAmount = transaction_type === 'c' ? amount : -amount;

        const { rows: [result] } = await client.query(updateBalanceQuery, [adjustAmount, account_id, amount, description, transaction_type]);

        if (transaction_type === 'd' && result.saldo < -result.limite) {
            throw new Error('Saldo insuficiente para realizar a transação.');
        }
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports.getBalanceByAccountId = async function (account_id) {
    const query = `
        SELECT
            a.limit_amount,
            b.amount
        FROM accounts a
        JOIN balances b ON a.id = b.account_id
        WHERE a.id = $1;
    `;
    const { rows } = await pool.query(query, [account_id]);
    return rows[0];
};

module.exports.getTransactionsByAccountId = async function (account_id) {
    const query = `
        SELECT
            amount AS valor,
            transaction_type AS tipo,
            description AS descricao,
            date AS realizada_em
        FROM transactions
        WHERE account_id = $1
        ORDER BY date DESC
        LIMIT 10;
    `;
    const { rows } = await pool.query(query, [account_id]);
    return rows;
};
