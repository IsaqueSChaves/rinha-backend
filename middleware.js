module.exports.validateBody = (body) => {
    const { valor, descricao, tipo } = body;
    const { id } = req.params;
    id = +id;
    valor = +valor;

    if (!id || !valor || !descricao || !tipo) return false;

    if (isNaN(id)) return false;

    if (isNaN(valor) || valor <= 0) return false;

    if (typeof tipo !== 'string' || tipo !== 'c' || tipo !== 'd' || tipo) return false;

    if (typeof descricao !== 'string' || descricao.length <= 0 || descricao.length > 10) return false;
    req.id = id;
    req.valor = valor;
    req.descricao = descricao;
    req.tipo = tipo;
    return true;
};

module.exports.validationFilter = (req, res, next) => {
    if (!this.validateBody(req.body))
        return res.status(422).end();
    next();
};

module.exports.errorHandler = (err, req, res, _) => {
    res.status(err.status || 500).end();
};