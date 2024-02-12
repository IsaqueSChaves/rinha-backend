module.exports.validateBody = (body, params) => {
    const { descricao, tipo } = body;
    let { valor } = body;
    let { id } = params;

    if (!id || !valor || !descricao || !tipo) return false;

    if (isNaN(+id)) return false;

    valor = +valor;
    if (isNaN(valor) || valor <= 0) return false;

    if (typeof tipo !== 'string' || (tipo !== 'c' && tipo !== 'd')) return false;

    if (typeof descricao !== 'string' || descricao.length <= 0 || descricao.length > 10) return false;

    return true;
};

module.exports.validationFilter = (req, res, next) => {
    if (!this.validateBody(req.body, req.params)) return res.status(422).end();
    next();
};

module.exports.errorHandler = (err, req, res, _) => {
    res.status(err.status || 500).end();
};