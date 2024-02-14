const pg = require('pg');

const URL = process.env.DB_URL || 'postgres://postgres:12345678@localhost:5432/postgres';

const pool = new pg.Pool({
    connectionString: URL,
    max: (Number(process.env.DB_POOL) || 200),
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000
});

pool.on('error', connect);

async function connect() {
    try {
        await pool.connect();
        console.log(`Connected to db ${URL}`);
    } catch (err) {
        console.error(`Error connecting to db: ${err}`);
        setTimeout(connect, 3000); // Retry connection after 3 seconds
    }
}

connect();

module.exports.insertTransaction = async function (account_id, amount, description, transaction_type) {
    try {
        // Primeira query: Verifica se a transação é permitida
        const { rows: [balance] } = await pool.query(`
            SELECT b.amount, a.limit_amount
            FROM balances b
            JOIN accounts a ON b.account_id = a.id
            WHERE b.account_id = $1
        `, [account_id]);

        const adjustAmount = transaction_type === 'c' ? amount : -amount;

        if (transaction_type === 'd' && (balance.amount + adjustAmount) < -balance.limit_amount) {
            throw new Error('Saldo insuficiente para realizar a transação.');
        }

        const result = await pool.query(`
            WITH updated_balance AS (
                UPDATE balances
                SET amount = amount + $2
                WHERE account_id = $1
                RETURNING amount
            ), inserted_transaction AS (
                INSERT INTO transactions (account_id, amount, description, transaction_type)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            )
            SELECT (SELECT amount FROM updated_balance) AS saldo, (SELECT limit_amount FROM accounts WHERE id = $1) AS limite;
        `, [account_id, adjustAmount, description, transaction_type]);

        return result.rows[0];
    } catch (err) {
        throw err;
    }
};

module.exports.getBalanceByAccountId = async function (account_id) {
    const query = `
        SELECT
            a.limit_amount AS limite,
            b.amount AS total 
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
            amount,
            transaction_type,
            description,
            date AS realizada_em
        FROM transactions
        WHERE account_id = $1
        ORDER BY date DESC
        LIMIT 10;
    `;
    const { rows } = await pool.query(query, [account_id]);
    return rows;
};
