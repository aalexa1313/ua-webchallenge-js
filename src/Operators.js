'use strict';

(function () {

    var view = {
        button: null,
        sourceInput: null,
        stackOutput: null,
        resultOutput: null
    }
    var state = {
        udfs: {},
        stack: [],
        operators: {}
    }

    function UserDefinedFunc(args, body) {
        this._args = args;
        this._body = body;
        this._cache = {};
    };
    UserDefinedFunc.prototype.Name = function () {
        return this._args[0];
    }
    UserDefinedFunc.prototype.Clear = function () {
        this._cache = {};
    }
    UserDefinedFunc.prototype.Call = function (list, operators, vars) {
        var i;
        var _vars = {};
        var result;
        if (this._args.length !== list.length) {
            throw ("Runtime error in user defined function '"+ this._args[0] +"'. Invalid params count");
        } else {
            _vars[this._args[0]] = list[0];
            for (i = 1; i < this._args.length; i++) {
                _vars[this._args[i]] = ExecList(list[i], operators, vars);
            }
            if (this._args.length !== 2) {
                result = ExecList(this._body, operators, _vars);
            } else { // Enable caching for Fibonachi function
                if (this._cache[_vars[this._args[1]]] !== undefined) {
                    result = this._cache[_vars[this._args[1]]];
                } else {
                    result = ExecList(this._body, operators, _vars);
                    this._cache[_vars[this._args[1]]] = result;
                }
            }
            return result;
        }
    };

    function RuntimeError(list) {
        throw ("Runtime error in list ('" + list.toString() + "') Invalid params count");
    }
    state.operators["+"] = function (list, operators, vars) {
        if (list.length !== 3) {
            RuntimeError(list);
        } else {
            return ExecList(list[1], operators, vars) + ExecList(list[2], operators, vars);
        }
    };
    state.operators["-"] = function (list, operators, vars) {
        if (list.length !== 3) {
            RuntimeError(list);
        } else {
            return ExecList(list[1], operators, vars) - ExecList(list[2], operators, vars);
        }
    };
    state.operators["*"] = function (list, operators, vars) {
        if (list.length !== 3) {
            RuntimeError(list);
        } else {
            return ExecList(list[1], operators, vars) * ExecList(list[2], operators, vars);
        }
    };
    state.operators["/"] = function (list, operators, vars) {
        if (list.length !== 3) {
            RuntimeError(list);
        } else {
            return ExecList(list[1], operators, vars) / ExecList(list[2], operators, vars);
        }
    };
    state.operators["="] = function (list, operators, vars) {
        if (list.length !== 3) {
            RuntimeError(list);
        } else {
            return ExecList(list[1], operators, vars) === ExecList(list[2], operators, vars);
        }
    };
    state.operators["if"] = function (list, operators, vars) {
        if (list.length < 3 || list.length > 4) {
            RuntimeError(list);
        } else {
            if (ExecList(list[1], operators, vars)) {
                return ExecList(list[2], operators, vars);
            } else {
                if (list.length > 3) {
                    return ExecList(list[3], operators, vars);
                }
            }
        }
    };
    state.operators["print"] = function (list, operators, vars) {
        if (list.length !== 2) {
            RuntimeError(list);
        } else {
            return ExecList(list[1], operators, vars);
        }
    };
    state.operators["sqrt"] = function (list, operators, vars) {
        if (list.length !== 2) {
            RuntimeError(list);
        } else {
            return Math.sqrt(ExecList(list[1], operators, vars));
        }
    };
    state.operators["define"] = function (list, operators, vars, udfs) {
        var udf;
        if (list.length !== 3) {
            RuntimeError(list);
        } else {
            udf = new UserDefinedFunc(list[1], list[2]);
            operators[udf.Name()] = udf.Call.bind(udf);
            udfs[udf.Name()] = udf;
            return udf.Name();
        }
    };

    // ======================================================================

    function Tokenize(s) {
        var result = [];
        var i = 0;
        var length = s.length;
        var token = "";
        var inLiteral = false;
        for (i = 0; i < length; i++) {
            if (inLiteral) {
                if (s[i] !== '"') {
                    token += s[i];
                } else {
                    token += '"';
                    result.push(token);
                    token = "";
                    inLiteral = false;
                }
            } else {
                switch (s[i]) {
                    case ' ':  
                        if (token !== "") {
                            result.push(token);
                            token = "";
                        }
                        break;
                    case '(':
                    case ')':
                        if (token !== "") {
                            result.push(token);
                            token = "";
                        }
                        result.push(s[i]);
                        break;
                    case '"':
                        if (token !== "") {
                            result.push(token);
                        }
                        token = '"';
                        inLiteral = true;
                        break;
                    default: token += s[i];
                }
            }
        }
        return result;
    }
    function GetBlockSource(tokens) {
        var count = 1;
        var result = {source : [], rest : tokens.splice(0)};
        var token = "";
        while (count > 0 && result.rest.length > 0) {
            token = result.rest.shift();
            if (token == "(") {
                count++;
                result.source.push(token);
            } else if (token == ")") {
                count--;
                if (count > 0) {
                    result.source.push(token);
                }
            } else {
                result.source.push(token);
            }
        }
        if (count == 0) {
            return result;
        } else {
            throw ("Compilation error. '(' count > ')' count in block '" + result.source.toString() + "'");
        }
    }
    function CompileList(tokens) {
        var result = [];
        var source = tokens.slice();
        var token;
        var block;
        while (source.length > 0) {
            token = source.shift();
            if (token == ")") {
                throw ("Compilation error. ')' count > '(' count in block '" + result.toString() + "'");
            } else if (token !== "(") {
                result.push(token);
            } else {
                block = GetBlockSource(source);
                result.push(CompileList(block.source));
                source = block.rest;
            }
        }
        return result;
    }
    function CompileMain(tokens) {
        if (tokens.length > 2) {
            var open = tokens.shift();
            var close = tokens.pop();
            if (open !== "(") {
                throw ("Compilation error. Not found expected '(' at program begin");
            }
            if (close !== ")") {
                throw ("Compilation error. Not found expected ')' at program end");
            }
            return CompileList(tokens);
        }
    }
    function ClearCache(udfs) {
        var operator;
        var key;
        for (key in udfs) {
            if (udfs.hasOwnProperty(key)) {
                udfs[key].Clear();
            }
        }
    }
    function ExecList(list, operators, vars) {
        var result;
        var operator;
        var value;
        var i;
        var input = list.toString();
        if (typeof list === "number" || typeof list === "boolean") {
            StackDebug(input, list.toString());
            return list;
        }
        if (typeof list === "string") {
            if (vars.hasOwnProperty(list) && vars[list] !== null) {
                list = ExecList(vars[list], operators, vars);
            }
            value = +list;
            if (value !== parseFloat(list) || value === Infinity) {
                return list;
            }
            StackDebug(input, value.toString());
            return value;
        } else if (list.length == 0) {
            throw ("Execution error. Empty list");
        } else {
            operator = list[0];
            if (operators.hasOwnProperty(operator) && operators[operator] !== null) {
                result = operators[operator](list, operators, vars, state.udfs);
                StackDebug(input, result.toString());
                return result;
            } else {
                if (list.length === 1) { // (x) => x
                    return ExecList(list[0], operators, vars);
                }
                else {
                    StackDebug(input, list.toString());
                    return list;
                }
            }
        }
    }
    function StackDebug(input, output) {
        state.stack.push(input + " => " + output);
    }

    // ===============================================================================================

    function Render(result, stack) {
        var s = "";
        var i;
        for (i = 0; i < stack.length; i++) {
            s += stack[i] + "<br/>";
        }
        view.resultOutput.innerHTML = "=> " + result.toString();
        view.stackOutPut.innerHTML = s;
    }

    function Execute() {
        var s;
        var result;
        var list;
        var tokens;
        state.stack = [];
        try {
            try {
                s = view.sourceInput.value.replace(/\n/g, "");
                tokens = Tokenize(s);
                list = CompileMain(tokens);
                result = ExecList(list, state.operators, {});
            } finally {
                ClearCache(state.udfs);
            }
        } catch (exc) {
            result = exc;
        }
        Render(result, state.stack);
    }

    function onLoad() {
        window.removeEventListener("load", onload);
        view.sourceInput = document.getElementById("source");
        view.stackOutPut = document.getElementById("stack");
        view.resultOutput = document.getElementById("output");
        view.button = document.getElementById("execute");
        view.button.addEventListener("click", Execute);
    }
    window.addEventListener("load", onLoad);
})();
