"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/isexe/windows.js
var require_windows = __commonJS({
  "node_modules/isexe/windows.js"(exports2, module2) {
    module2.exports = isexe;
    isexe.sync = sync;
    var fs4 = require("fs");
    function checkPathExt(path2, options) {
      var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
      if (!pathext) {
        return true;
      }
      pathext = pathext.split(";");
      if (pathext.indexOf("") !== -1) {
        return true;
      }
      for (var i = 0; i < pathext.length; i++) {
        var p = pathext[i].toLowerCase();
        if (p && path2.substr(-p.length).toLowerCase() === p) {
          return true;
        }
      }
      return false;
    }
    function checkStat(stat, path2, options) {
      if (!stat.isSymbolicLink() && !stat.isFile()) {
        return false;
      }
      return checkPathExt(path2, options);
    }
    function isexe(path2, options, cb) {
      fs4.stat(path2, function(er, stat) {
        cb(er, er ? false : checkStat(stat, path2, options));
      });
    }
    function sync(path2, options) {
      return checkStat(fs4.statSync(path2), path2, options);
    }
  }
});

// node_modules/isexe/mode.js
var require_mode = __commonJS({
  "node_modules/isexe/mode.js"(exports2, module2) {
    module2.exports = isexe;
    isexe.sync = sync;
    var fs4 = require("fs");
    function isexe(path2, options, cb) {
      fs4.stat(path2, function(er, stat) {
        cb(er, er ? false : checkStat(stat, options));
      });
    }
    function sync(path2, options) {
      return checkStat(fs4.statSync(path2), options);
    }
    function checkStat(stat, options) {
      return stat.isFile() && checkMode(stat, options);
    }
    function checkMode(stat, options) {
      var mod = stat.mode;
      var uid = stat.uid;
      var gid = stat.gid;
      var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
      var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
      var u = parseInt("100", 8);
      var g = parseInt("010", 8);
      var o = parseInt("001", 8);
      var ug = u | g;
      var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
      return ret;
    }
  }
});

// node_modules/isexe/index.js
var require_isexe = __commonJS({
  "node_modules/isexe/index.js"(exports2, module2) {
    var fs4 = require("fs");
    var core;
    if (process.platform === "win32" || global.TESTING_WINDOWS) {
      core = require_windows();
    } else {
      core = require_mode();
    }
    module2.exports = isexe;
    isexe.sync = sync;
    function isexe(path2, options, cb) {
      if (typeof options === "function") {
        cb = options;
        options = {};
      }
      if (!cb) {
        if (typeof Promise !== "function") {
          throw new TypeError("callback not provided");
        }
        return new Promise(function(resolve, reject) {
          isexe(path2, options || {}, function(er, is) {
            if (er) {
              reject(er);
            } else {
              resolve(is);
            }
          });
        });
      }
      core(path2, options || {}, function(er, is) {
        if (er) {
          if (er.code === "EACCES" || options && options.ignoreErrors) {
            er = null;
            is = false;
          }
        }
        cb(er, is);
      });
    }
    function sync(path2, options) {
      try {
        return core.sync(path2, options || {});
      } catch (er) {
        if (options && options.ignoreErrors || er.code === "EACCES") {
          return false;
        } else {
          throw er;
        }
      }
    }
  }
});

// node_modules/which/which.js
var require_which = __commonJS({
  "node_modules/which/which.js"(exports2, module2) {
    var isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
    var path2 = require("path");
    var COLON = isWindows ? ";" : ":";
    var isexe = require_isexe();
    var getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
    var getPathInfo = (cmd, opt) => {
      const colon = opt.colon || COLON;
      const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
        // windows always checks the cwd first
        ...isWindows ? [process.cwd()] : [],
        ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
        "").split(colon)
      ];
      const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
      const pathExt = isWindows ? pathExtExe.split(colon) : [""];
      if (isWindows) {
        if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
          pathExt.unshift("");
      }
      return {
        pathEnv,
        pathExt,
        pathExtExe
      };
    };
    var which = (cmd, opt, cb) => {
      if (typeof opt === "function") {
        cb = opt;
        opt = {};
      }
      if (!opt)
        opt = {};
      const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      const found = [];
      const step = (i) => new Promise((resolve, reject) => {
        if (i === pathEnv.length)
          return opt.all && found.length ? resolve(found) : reject(getNotFoundError(cmd));
        const ppRaw = pathEnv[i];
        const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
        const pCmd = path2.join(pathPart, cmd);
        const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        resolve(subStep(p, i, 0));
      });
      const subStep = (p, i, ii) => new Promise((resolve, reject) => {
        if (ii === pathExt.length)
          return resolve(step(i + 1));
        const ext = pathExt[ii];
        isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
          if (!er && is) {
            if (opt.all)
              found.push(p + ext);
            else
              return resolve(p + ext);
          }
          return resolve(subStep(p, i, ii + 1));
        });
      });
      return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
    };
    var whichSync = (cmd, opt) => {
      opt = opt || {};
      const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      const found = [];
      for (let i = 0; i < pathEnv.length; i++) {
        const ppRaw = pathEnv[i];
        const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
        const pCmd = path2.join(pathPart, cmd);
        const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        for (let j = 0; j < pathExt.length; j++) {
          const cur = p + pathExt[j];
          try {
            const is = isexe.sync(cur, { pathExt: pathExtExe });
            if (is) {
              if (opt.all)
                found.push(cur);
              else
                return cur;
            }
          } catch (ex) {
          }
        }
      }
      if (opt.all && found.length)
        return found;
      if (opt.nothrow)
        return null;
      throw getNotFoundError(cmd);
    };
    module2.exports = which;
    which.sync = whichSync;
  }
});

// node_modules/path-key/index.js
var require_path_key = __commonJS({
  "node_modules/path-key/index.js"(exports2, module2) {
    "use strict";
    var pathKey = (options = {}) => {
      const environment = options.env || process.env;
      const platform = options.platform || process.platform;
      if (platform !== "win32") {
        return "PATH";
      }
      return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
    };
    module2.exports = pathKey;
    module2.exports.default = pathKey;
  }
});

// node_modules/cross-spawn/lib/util/resolveCommand.js
var require_resolveCommand = __commonJS({
  "node_modules/cross-spawn/lib/util/resolveCommand.js"(exports2, module2) {
    "use strict";
    var path2 = require("path");
    var which = require_which();
    var getPathKey = require_path_key();
    function resolveCommandAttempt(parsed, withoutPathExt) {
      const env = parsed.options.env || process.env;
      const cwd = process.cwd();
      const hasCustomCwd = parsed.options.cwd != null;
      const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
      if (shouldSwitchCwd) {
        try {
          process.chdir(parsed.options.cwd);
        } catch (err) {
        }
      }
      let resolved;
      try {
        resolved = which.sync(parsed.command, {
          path: env[getPathKey({ env })],
          pathExt: withoutPathExt ? path2.delimiter : void 0
        });
      } catch (e) {
      } finally {
        if (shouldSwitchCwd) {
          process.chdir(cwd);
        }
      }
      if (resolved) {
        resolved = path2.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
      }
      return resolved;
    }
    function resolveCommand(parsed) {
      return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
    }
    module2.exports = resolveCommand;
  }
});

// node_modules/cross-spawn/lib/util/escape.js
var require_escape = __commonJS({
  "node_modules/cross-spawn/lib/util/escape.js"(exports2, module2) {
    "use strict";
    var metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
    function escapeCommand(arg) {
      arg = arg.replace(metaCharsRegExp, "^$1");
      return arg;
    }
    function escapeArgument(arg, doubleEscapeMetaChars) {
      arg = `${arg}`;
      arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
      arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
      arg = `"${arg}"`;
      arg = arg.replace(metaCharsRegExp, "^$1");
      if (doubleEscapeMetaChars) {
        arg = arg.replace(metaCharsRegExp, "^$1");
      }
      return arg;
    }
    module2.exports.command = escapeCommand;
    module2.exports.argument = escapeArgument;
  }
});

// node_modules/shebang-regex/index.js
var require_shebang_regex = __commonJS({
  "node_modules/shebang-regex/index.js"(exports2, module2) {
    "use strict";
    module2.exports = /^#!(.*)/;
  }
});

// node_modules/shebang-command/index.js
var require_shebang_command = __commonJS({
  "node_modules/shebang-command/index.js"(exports2, module2) {
    "use strict";
    var shebangRegex = require_shebang_regex();
    module2.exports = (string = "") => {
      const match = string.match(shebangRegex);
      if (!match) {
        return null;
      }
      const [path2, argument] = match[0].replace(/#! ?/, "").split(" ");
      const binary = path2.split("/").pop();
      if (binary === "env") {
        return argument;
      }
      return argument ? `${binary} ${argument}` : binary;
    };
  }
});

// node_modules/cross-spawn/lib/util/readShebang.js
var require_readShebang = __commonJS({
  "node_modules/cross-spawn/lib/util/readShebang.js"(exports2, module2) {
    "use strict";
    var fs4 = require("fs");
    var shebangCommand = require_shebang_command();
    function readShebang(command) {
      const size = 150;
      const buffer = Buffer.alloc(size);
      let fd;
      try {
        fd = fs4.openSync(command, "r");
        fs4.readSync(fd, buffer, 0, size, 0);
        fs4.closeSync(fd);
      } catch (e) {
      }
      return shebangCommand(buffer.toString());
    }
    module2.exports = readShebang;
  }
});

// node_modules/cross-spawn/lib/parse.js
var require_parse = __commonJS({
  "node_modules/cross-spawn/lib/parse.js"(exports2, module2) {
    "use strict";
    var path2 = require("path");
    var resolveCommand = require_resolveCommand();
    var escape = require_escape();
    var readShebang = require_readShebang();
    var isWin = process.platform === "win32";
    var isExecutableRegExp = /\.(?:com|exe)$/i;
    var isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
    function detectShebang(parsed) {
      parsed.file = resolveCommand(parsed);
      const shebang = parsed.file && readShebang(parsed.file);
      if (shebang) {
        parsed.args.unshift(parsed.file);
        parsed.command = shebang;
        return resolveCommand(parsed);
      }
      return parsed.file;
    }
    function parseNonShell(parsed) {
      if (!isWin) {
        return parsed;
      }
      const commandFile = detectShebang(parsed);
      const needsShell = !isExecutableRegExp.test(commandFile);
      if (parsed.options.forceShell || needsShell) {
        const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
        parsed.command = path2.normalize(parsed.command);
        parsed.command = escape.command(parsed.command);
        parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
        const shellCommand = [parsed.command].concat(parsed.args).join(" ");
        parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
        parsed.command = process.env.comspec || "cmd.exe";
        parsed.options.windowsVerbatimArguments = true;
      }
      return parsed;
    }
    function parse(command, args, options) {
      if (args && !Array.isArray(args)) {
        options = args;
        args = null;
      }
      args = args ? args.slice(0) : [];
      options = Object.assign({}, options);
      const parsed = {
        command,
        args,
        options,
        file: void 0,
        original: {
          command,
          args
        }
      };
      return options.shell ? parsed : parseNonShell(parsed);
    }
    module2.exports = parse;
  }
});

// node_modules/cross-spawn/lib/enoent.js
var require_enoent = __commonJS({
  "node_modules/cross-spawn/lib/enoent.js"(exports2, module2) {
    "use strict";
    var isWin = process.platform === "win32";
    function notFoundError(original, syscall) {
      return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
        code: "ENOENT",
        errno: "ENOENT",
        syscall: `${syscall} ${original.command}`,
        path: original.command,
        spawnargs: original.args
      });
    }
    function hookChildProcess(cp, parsed) {
      if (!isWin) {
        return;
      }
      const originalEmit = cp.emit;
      cp.emit = function(name, arg1) {
        if (name === "exit") {
          const err = verifyENOENT(arg1, parsed);
          if (err) {
            return originalEmit.call(cp, "error", err);
          }
        }
        return originalEmit.apply(cp, arguments);
      };
    }
    function verifyENOENT(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, "spawn");
      }
      return null;
    }
    function verifyENOENTSync(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, "spawnSync");
      }
      return null;
    }
    module2.exports = {
      hookChildProcess,
      verifyENOENT,
      verifyENOENTSync,
      notFoundError
    };
  }
});

// node_modules/cross-spawn/index.js
var require_cross_spawn = __commonJS({
  "node_modules/cross-spawn/index.js"(exports2, module2) {
    "use strict";
    var cp = require("child_process");
    var parse = require_parse();
    var enoent = require_enoent();
    function spawn2(command, args, options) {
      const parsed = parse(command, args, options);
      const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
      enoent.hookChildProcess(spawned, parsed);
      return spawned;
    }
    function spawnSync(command, args, options) {
      const parsed = parse(command, args, options);
      const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
      result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
      return result;
    }
    module2.exports = spawn2;
    module2.exports.spawn = spawn2;
    module2.exports.sync = spawnSync;
    module2.exports._parse = parse;
    module2.exports._enoent = enoent;
  }
});

// node_modules/strip-final-newline/index.js
var require_strip_final_newline = __commonJS({
  "node_modules/strip-final-newline/index.js"(exports2, module2) {
    "use strict";
    module2.exports = (input) => {
      const LF = typeof input === "string" ? "\n" : "\n".charCodeAt();
      const CR = typeof input === "string" ? "\r" : "\r".charCodeAt();
      if (input[input.length - 1] === LF) {
        input = input.slice(0, input.length - 1);
      }
      if (input[input.length - 1] === CR) {
        input = input.slice(0, input.length - 1);
      }
      return input;
    };
  }
});

// node_modules/npm-run-path/index.js
var require_npm_run_path = __commonJS({
  "node_modules/npm-run-path/index.js"(exports2, module2) {
    "use strict";
    var path2 = require("path");
    var pathKey = require_path_key();
    var npmRunPath = (options) => {
      options = {
        cwd: process.cwd(),
        path: process.env[pathKey()],
        execPath: process.execPath,
        ...options
      };
      let previous;
      let cwdPath = path2.resolve(options.cwd);
      const result = [];
      while (previous !== cwdPath) {
        result.push(path2.join(cwdPath, "node_modules/.bin"));
        previous = cwdPath;
        cwdPath = path2.resolve(cwdPath, "..");
      }
      const execPathDir = path2.resolve(options.cwd, options.execPath, "..");
      result.push(execPathDir);
      return result.concat(options.path).join(path2.delimiter);
    };
    module2.exports = npmRunPath;
    module2.exports.default = npmRunPath;
    module2.exports.env = (options) => {
      options = {
        env: process.env,
        ...options
      };
      const env = { ...options.env };
      const path3 = pathKey({ env });
      options.path = env[path3];
      env[path3] = module2.exports(options);
      return env;
    };
  }
});

// node_modules/mimic-fn/index.js
var require_mimic_fn = __commonJS({
  "node_modules/mimic-fn/index.js"(exports2, module2) {
    "use strict";
    var mimicFn = (to, from) => {
      for (const prop of Reflect.ownKeys(from)) {
        Object.defineProperty(to, prop, Object.getOwnPropertyDescriptor(from, prop));
      }
      return to;
    };
    module2.exports = mimicFn;
    module2.exports.default = mimicFn;
  }
});

// node_modules/onetime/index.js
var require_onetime = __commonJS({
  "node_modules/onetime/index.js"(exports2, module2) {
    "use strict";
    var mimicFn = require_mimic_fn();
    var calledFunctions = /* @__PURE__ */ new WeakMap();
    var onetime = (function_, options = {}) => {
      if (typeof function_ !== "function") {
        throw new TypeError("Expected a function");
      }
      let returnValue;
      let callCount = 0;
      const functionName = function_.displayName || function_.name || "<anonymous>";
      const onetime2 = function(...arguments_) {
        calledFunctions.set(onetime2, ++callCount);
        if (callCount === 1) {
          returnValue = function_.apply(this, arguments_);
          function_ = null;
        } else if (options.throw === true) {
          throw new Error(`Function \`${functionName}\` can only be called once`);
        }
        return returnValue;
      };
      mimicFn(onetime2, function_);
      calledFunctions.set(onetime2, callCount);
      return onetime2;
    };
    module2.exports = onetime;
    module2.exports.default = onetime;
    module2.exports.callCount = (function_) => {
      if (!calledFunctions.has(function_)) {
        throw new Error(`The given function \`${function_.name}\` is not wrapped by the \`onetime\` package`);
      }
      return calledFunctions.get(function_);
    };
  }
});

// node_modules/human-signals/build/src/core.js
var require_core = __commonJS({
  "node_modules/human-signals/build/src/core.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SIGNALS = void 0;
    var SIGNALS = [
      {
        name: "SIGHUP",
        number: 1,
        action: "terminate",
        description: "Terminal closed",
        standard: "posix"
      },
      {
        name: "SIGINT",
        number: 2,
        action: "terminate",
        description: "User interruption with CTRL-C",
        standard: "ansi"
      },
      {
        name: "SIGQUIT",
        number: 3,
        action: "core",
        description: "User interruption with CTRL-\\",
        standard: "posix"
      },
      {
        name: "SIGILL",
        number: 4,
        action: "core",
        description: "Invalid machine instruction",
        standard: "ansi"
      },
      {
        name: "SIGTRAP",
        number: 5,
        action: "core",
        description: "Debugger breakpoint",
        standard: "posix"
      },
      {
        name: "SIGABRT",
        number: 6,
        action: "core",
        description: "Aborted",
        standard: "ansi"
      },
      {
        name: "SIGIOT",
        number: 6,
        action: "core",
        description: "Aborted",
        standard: "bsd"
      },
      {
        name: "SIGBUS",
        number: 7,
        action: "core",
        description: "Bus error due to misaligned, non-existing address or paging error",
        standard: "bsd"
      },
      {
        name: "SIGEMT",
        number: 7,
        action: "terminate",
        description: "Command should be emulated but is not implemented",
        standard: "other"
      },
      {
        name: "SIGFPE",
        number: 8,
        action: "core",
        description: "Floating point arithmetic error",
        standard: "ansi"
      },
      {
        name: "SIGKILL",
        number: 9,
        action: "terminate",
        description: "Forced termination",
        standard: "posix",
        forced: true
      },
      {
        name: "SIGUSR1",
        number: 10,
        action: "terminate",
        description: "Application-specific signal",
        standard: "posix"
      },
      {
        name: "SIGSEGV",
        number: 11,
        action: "core",
        description: "Segmentation fault",
        standard: "ansi"
      },
      {
        name: "SIGUSR2",
        number: 12,
        action: "terminate",
        description: "Application-specific signal",
        standard: "posix"
      },
      {
        name: "SIGPIPE",
        number: 13,
        action: "terminate",
        description: "Broken pipe or socket",
        standard: "posix"
      },
      {
        name: "SIGALRM",
        number: 14,
        action: "terminate",
        description: "Timeout or timer",
        standard: "posix"
      },
      {
        name: "SIGTERM",
        number: 15,
        action: "terminate",
        description: "Termination",
        standard: "ansi"
      },
      {
        name: "SIGSTKFLT",
        number: 16,
        action: "terminate",
        description: "Stack is empty or overflowed",
        standard: "other"
      },
      {
        name: "SIGCHLD",
        number: 17,
        action: "ignore",
        description: "Child process terminated, paused or unpaused",
        standard: "posix"
      },
      {
        name: "SIGCLD",
        number: 17,
        action: "ignore",
        description: "Child process terminated, paused or unpaused",
        standard: "other"
      },
      {
        name: "SIGCONT",
        number: 18,
        action: "unpause",
        description: "Unpaused",
        standard: "posix",
        forced: true
      },
      {
        name: "SIGSTOP",
        number: 19,
        action: "pause",
        description: "Paused",
        standard: "posix",
        forced: true
      },
      {
        name: "SIGTSTP",
        number: 20,
        action: "pause",
        description: 'Paused using CTRL-Z or "suspend"',
        standard: "posix"
      },
      {
        name: "SIGTTIN",
        number: 21,
        action: "pause",
        description: "Background process cannot read terminal input",
        standard: "posix"
      },
      {
        name: "SIGBREAK",
        number: 21,
        action: "terminate",
        description: "User interruption with CTRL-BREAK",
        standard: "other"
      },
      {
        name: "SIGTTOU",
        number: 22,
        action: "pause",
        description: "Background process cannot write to terminal output",
        standard: "posix"
      },
      {
        name: "SIGURG",
        number: 23,
        action: "ignore",
        description: "Socket received out-of-band data",
        standard: "bsd"
      },
      {
        name: "SIGXCPU",
        number: 24,
        action: "core",
        description: "Process timed out",
        standard: "bsd"
      },
      {
        name: "SIGXFSZ",
        number: 25,
        action: "core",
        description: "File too big",
        standard: "bsd"
      },
      {
        name: "SIGVTALRM",
        number: 26,
        action: "terminate",
        description: "Timeout or timer",
        standard: "bsd"
      },
      {
        name: "SIGPROF",
        number: 27,
        action: "terminate",
        description: "Timeout or timer",
        standard: "bsd"
      },
      {
        name: "SIGWINCH",
        number: 28,
        action: "ignore",
        description: "Terminal window size changed",
        standard: "bsd"
      },
      {
        name: "SIGIO",
        number: 29,
        action: "terminate",
        description: "I/O is available",
        standard: "other"
      },
      {
        name: "SIGPOLL",
        number: 29,
        action: "terminate",
        description: "Watched event",
        standard: "other"
      },
      {
        name: "SIGINFO",
        number: 29,
        action: "ignore",
        description: "Request for process information",
        standard: "other"
      },
      {
        name: "SIGPWR",
        number: 30,
        action: "terminate",
        description: "Device running out of power",
        standard: "systemv"
      },
      {
        name: "SIGSYS",
        number: 31,
        action: "core",
        description: "Invalid system call",
        standard: "other"
      },
      {
        name: "SIGUNUSED",
        number: 31,
        action: "terminate",
        description: "Invalid system call",
        standard: "other"
      }
    ];
    exports2.SIGNALS = SIGNALS;
  }
});

// node_modules/human-signals/build/src/realtime.js
var require_realtime = __commonJS({
  "node_modules/human-signals/build/src/realtime.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SIGRTMAX = exports2.getRealtimeSignals = void 0;
    var getRealtimeSignals = function() {
      const length = SIGRTMAX - SIGRTMIN + 1;
      return Array.from({ length }, getRealtimeSignal);
    };
    exports2.getRealtimeSignals = getRealtimeSignals;
    var getRealtimeSignal = function(value, index) {
      return {
        name: `SIGRT${index + 1}`,
        number: SIGRTMIN + index,
        action: "terminate",
        description: "Application-specific signal (realtime)",
        standard: "posix"
      };
    };
    var SIGRTMIN = 34;
    var SIGRTMAX = 64;
    exports2.SIGRTMAX = SIGRTMAX;
  }
});

// node_modules/human-signals/build/src/signals.js
var require_signals = __commonJS({
  "node_modules/human-signals/build/src/signals.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getSignals = void 0;
    var _os = require("os");
    var _core = require_core();
    var _realtime = require_realtime();
    var getSignals = function() {
      const realtimeSignals = (0, _realtime.getRealtimeSignals)();
      const signals = [..._core.SIGNALS, ...realtimeSignals].map(normalizeSignal);
      return signals;
    };
    exports2.getSignals = getSignals;
    var normalizeSignal = function({
      name,
      number: defaultNumber,
      description,
      action,
      forced = false,
      standard
    }) {
      const {
        signals: { [name]: constantSignal }
      } = _os.constants;
      const supported = constantSignal !== void 0;
      const number = supported ? constantSignal : defaultNumber;
      return { name, number, description, supported, action, forced, standard };
    };
  }
});

// node_modules/human-signals/build/src/main.js
var require_main = __commonJS({
  "node_modules/human-signals/build/src/main.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.signalsByNumber = exports2.signalsByName = void 0;
    var _os = require("os");
    var _signals = require_signals();
    var _realtime = require_realtime();
    var getSignalsByName = function() {
      const signals = (0, _signals.getSignals)();
      return signals.reduce(getSignalByName, {});
    };
    var getSignalByName = function(signalByNameMemo, { name, number, description, supported, action, forced, standard }) {
      return {
        ...signalByNameMemo,
        [name]: { name, number, description, supported, action, forced, standard }
      };
    };
    var signalsByName = getSignalsByName();
    exports2.signalsByName = signalsByName;
    var getSignalsByNumber = function() {
      const signals = (0, _signals.getSignals)();
      const length = _realtime.SIGRTMAX + 1;
      const signalsA = Array.from({ length }, (value, number) => getSignalByNumber(number, signals));
      return Object.assign({}, ...signalsA);
    };
    var getSignalByNumber = function(number, signals) {
      const signal = findSignalByNumber(number, signals);
      if (signal === void 0) {
        return {};
      }
      const { name, description, supported, action, forced, standard } = signal;
      return {
        [number]: {
          name,
          number,
          description,
          supported,
          action,
          forced,
          standard
        }
      };
    };
    var findSignalByNumber = function(number, signals) {
      const signal = signals.find(({ name }) => _os.constants.signals[name] === number);
      if (signal !== void 0) {
        return signal;
      }
      return signals.find((signalA) => signalA.number === number);
    };
    var signalsByNumber = getSignalsByNumber();
    exports2.signalsByNumber = signalsByNumber;
  }
});

// node_modules/execa/lib/error.js
var require_error = __commonJS({
  "node_modules/execa/lib/error.js"(exports2, module2) {
    "use strict";
    var { signalsByName } = require_main();
    var getErrorPrefix = ({ timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled }) => {
      if (timedOut) {
        return `timed out after ${timeout} milliseconds`;
      }
      if (isCanceled) {
        return "was canceled";
      }
      if (errorCode !== void 0) {
        return `failed with ${errorCode}`;
      }
      if (signal !== void 0) {
        return `was killed with ${signal} (${signalDescription})`;
      }
      if (exitCode !== void 0) {
        return `failed with exit code ${exitCode}`;
      }
      return "failed";
    };
    var makeError = ({
      stdout,
      stderr,
      all,
      error,
      signal,
      exitCode,
      command,
      escapedCommand,
      timedOut,
      isCanceled,
      killed,
      parsed: { options: { timeout } }
    }) => {
      exitCode = exitCode === null ? void 0 : exitCode;
      signal = signal === null ? void 0 : signal;
      const signalDescription = signal === void 0 ? void 0 : signalsByName[signal].description;
      const errorCode = error && error.code;
      const prefix = getErrorPrefix({ timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled });
      const execaMessage = `Command ${prefix}: ${command}`;
      const isError = Object.prototype.toString.call(error) === "[object Error]";
      const shortMessage = isError ? `${execaMessage}
${error.message}` : execaMessage;
      const message = [shortMessage, stderr, stdout].filter(Boolean).join("\n");
      if (isError) {
        error.originalMessage = error.message;
        error.message = message;
      } else {
        error = new Error(message);
      }
      error.shortMessage = shortMessage;
      error.command = command;
      error.escapedCommand = escapedCommand;
      error.exitCode = exitCode;
      error.signal = signal;
      error.signalDescription = signalDescription;
      error.stdout = stdout;
      error.stderr = stderr;
      if (all !== void 0) {
        error.all = all;
      }
      if ("bufferedData" in error) {
        delete error.bufferedData;
      }
      error.failed = true;
      error.timedOut = Boolean(timedOut);
      error.isCanceled = isCanceled;
      error.killed = killed && !timedOut;
      return error;
    };
    module2.exports = makeError;
  }
});

// node_modules/execa/lib/stdio.js
var require_stdio = __commonJS({
  "node_modules/execa/lib/stdio.js"(exports2, module2) {
    "use strict";
    var aliases = ["stdin", "stdout", "stderr"];
    var hasAlias = (options) => aliases.some((alias) => options[alias] !== void 0);
    var normalizeStdio = (options) => {
      if (!options) {
        return;
      }
      const { stdio } = options;
      if (stdio === void 0) {
        return aliases.map((alias) => options[alias]);
      }
      if (hasAlias(options)) {
        throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${aliases.map((alias) => `\`${alias}\``).join(", ")}`);
      }
      if (typeof stdio === "string") {
        return stdio;
      }
      if (!Array.isArray(stdio)) {
        throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof stdio}\``);
      }
      const length = Math.max(stdio.length, aliases.length);
      return Array.from({ length }, (value, index) => stdio[index]);
    };
    module2.exports = normalizeStdio;
    module2.exports.node = (options) => {
      const stdio = normalizeStdio(options);
      if (stdio === "ipc") {
        return "ipc";
      }
      if (stdio === void 0 || typeof stdio === "string") {
        return [stdio, stdio, stdio, "ipc"];
      }
      if (stdio.includes("ipc")) {
        return stdio;
      }
      return [...stdio, "ipc"];
    };
  }
});

// node_modules/signal-exit/signals.js
var require_signals2 = __commonJS({
  "node_modules/signal-exit/signals.js"(exports2, module2) {
    module2.exports = [
      "SIGABRT",
      "SIGALRM",
      "SIGHUP",
      "SIGINT",
      "SIGTERM"
    ];
    if (process.platform !== "win32") {
      module2.exports.push(
        "SIGVTALRM",
        "SIGXCPU",
        "SIGXFSZ",
        "SIGUSR2",
        "SIGTRAP",
        "SIGSYS",
        "SIGQUIT",
        "SIGIOT"
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === "linux") {
      module2.exports.push(
        "SIGIO",
        "SIGPOLL",
        "SIGPWR",
        "SIGSTKFLT",
        "SIGUNUSED"
      );
    }
  }
});

// node_modules/signal-exit/index.js
var require_signal_exit = __commonJS({
  "node_modules/signal-exit/index.js"(exports2, module2) {
    var process2 = global.process;
    var processOk = function(process3) {
      return process3 && typeof process3 === "object" && typeof process3.removeListener === "function" && typeof process3.emit === "function" && typeof process3.reallyExit === "function" && typeof process3.listeners === "function" && typeof process3.kill === "function" && typeof process3.pid === "number" && typeof process3.on === "function";
    };
    if (!processOk(process2)) {
      module2.exports = function() {
        return function() {
        };
      };
    } else {
      assert = require("assert");
      signals = require_signals2();
      isWin = /^win/i.test(process2.platform);
      EE = require("events");
      if (typeof EE !== "function") {
        EE = EE.EventEmitter;
      }
      if (process2.__signal_exit_emitter__) {
        emitter = process2.__signal_exit_emitter__;
      } else {
        emitter = process2.__signal_exit_emitter__ = new EE();
        emitter.count = 0;
        emitter.emitted = {};
      }
      if (!emitter.infinite) {
        emitter.setMaxListeners(Infinity);
        emitter.infinite = true;
      }
      module2.exports = function(cb, opts) {
        if (!processOk(global.process)) {
          return function() {
          };
        }
        assert.equal(typeof cb, "function", "a callback must be provided for exit handler");
        if (loaded === false) {
          load();
        }
        var ev = "exit";
        if (opts && opts.alwaysLast) {
          ev = "afterexit";
        }
        var remove = function() {
          emitter.removeListener(ev, cb);
          if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) {
            unload();
          }
        };
        emitter.on(ev, cb);
        return remove;
      };
      unload = function unload2() {
        if (!loaded || !processOk(global.process)) {
          return;
        }
        loaded = false;
        signals.forEach(function(sig) {
          try {
            process2.removeListener(sig, sigListeners[sig]);
          } catch (er) {
          }
        });
        process2.emit = originalProcessEmit;
        process2.reallyExit = originalProcessReallyExit;
        emitter.count -= 1;
      };
      module2.exports.unload = unload;
      emit = function emit2(event, code, signal) {
        if (emitter.emitted[event]) {
          return;
        }
        emitter.emitted[event] = true;
        emitter.emit(event, code, signal);
      };
      sigListeners = {};
      signals.forEach(function(sig) {
        sigListeners[sig] = function listener() {
          if (!processOk(global.process)) {
            return;
          }
          var listeners = process2.listeners(sig);
          if (listeners.length === emitter.count) {
            unload();
            emit("exit", null, sig);
            emit("afterexit", null, sig);
            if (isWin && sig === "SIGHUP") {
              sig = "SIGINT";
            }
            process2.kill(process2.pid, sig);
          }
        };
      });
      module2.exports.signals = function() {
        return signals;
      };
      loaded = false;
      load = function load2() {
        if (loaded || !processOk(global.process)) {
          return;
        }
        loaded = true;
        emitter.count += 1;
        signals = signals.filter(function(sig) {
          try {
            process2.on(sig, sigListeners[sig]);
            return true;
          } catch (er) {
            return false;
          }
        });
        process2.emit = processEmit;
        process2.reallyExit = processReallyExit;
      };
      module2.exports.load = load;
      originalProcessReallyExit = process2.reallyExit;
      processReallyExit = function processReallyExit2(code) {
        if (!processOk(global.process)) {
          return;
        }
        process2.exitCode = code || /* istanbul ignore next */
        0;
        emit("exit", process2.exitCode, null);
        emit("afterexit", process2.exitCode, null);
        originalProcessReallyExit.call(process2, process2.exitCode);
      };
      originalProcessEmit = process2.emit;
      processEmit = function processEmit2(ev, arg) {
        if (ev === "exit" && processOk(global.process)) {
          if (arg !== void 0) {
            process2.exitCode = arg;
          }
          var ret = originalProcessEmit.apply(this, arguments);
          emit("exit", process2.exitCode, null);
          emit("afterexit", process2.exitCode, null);
          return ret;
        } else {
          return originalProcessEmit.apply(this, arguments);
        }
      };
    }
    var assert;
    var signals;
    var isWin;
    var EE;
    var emitter;
    var unload;
    var emit;
    var sigListeners;
    var loaded;
    var load;
    var originalProcessReallyExit;
    var processReallyExit;
    var originalProcessEmit;
    var processEmit;
  }
});

// node_modules/execa/lib/kill.js
var require_kill = __commonJS({
  "node_modules/execa/lib/kill.js"(exports2, module2) {
    "use strict";
    var os2 = require("os");
    var onExit = require_signal_exit();
    var DEFAULT_FORCE_KILL_TIMEOUT = 1e3 * 5;
    var spawnedKill = (kill, signal = "SIGTERM", options = {}) => {
      const killResult = kill(signal);
      setKillTimeout(kill, signal, options, killResult);
      return killResult;
    };
    var setKillTimeout = (kill, signal, options, killResult) => {
      if (!shouldForceKill(signal, options, killResult)) {
        return;
      }
      const timeout = getForceKillAfterTimeout(options);
      const t = setTimeout(() => {
        kill("SIGKILL");
      }, timeout);
      if (t.unref) {
        t.unref();
      }
    };
    var shouldForceKill = (signal, { forceKillAfterTimeout }, killResult) => {
      return isSigterm(signal) && forceKillAfterTimeout !== false && killResult;
    };
    var isSigterm = (signal) => {
      return signal === os2.constants.signals.SIGTERM || typeof signal === "string" && signal.toUpperCase() === "SIGTERM";
    };
    var getForceKillAfterTimeout = ({ forceKillAfterTimeout = true }) => {
      if (forceKillAfterTimeout === true) {
        return DEFAULT_FORCE_KILL_TIMEOUT;
      }
      if (!Number.isFinite(forceKillAfterTimeout) || forceKillAfterTimeout < 0) {
        throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${forceKillAfterTimeout}\` (${typeof forceKillAfterTimeout})`);
      }
      return forceKillAfterTimeout;
    };
    var spawnedCancel = (spawned, context) => {
      const killResult = spawned.kill();
      if (killResult) {
        context.isCanceled = true;
      }
    };
    var timeoutKill = (spawned, signal, reject) => {
      spawned.kill(signal);
      reject(Object.assign(new Error("Timed out"), { timedOut: true, signal }));
    };
    var setupTimeout = (spawned, { timeout, killSignal = "SIGTERM" }, spawnedPromise) => {
      if (timeout === 0 || timeout === void 0) {
        return spawnedPromise;
      }
      let timeoutId;
      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          timeoutKill(spawned, killSignal, reject);
        }, timeout);
      });
      const safeSpawnedPromise = spawnedPromise.finally(() => {
        clearTimeout(timeoutId);
      });
      return Promise.race([timeoutPromise, safeSpawnedPromise]);
    };
    var validateTimeout = ({ timeout }) => {
      if (timeout !== void 0 && (!Number.isFinite(timeout) || timeout < 0)) {
        throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${timeout}\` (${typeof timeout})`);
      }
    };
    var setExitHandler = async (spawned, { cleanup, detached }, timedPromise) => {
      if (!cleanup || detached) {
        return timedPromise;
      }
      const removeExitHandler = onExit(() => {
        spawned.kill();
      });
      return timedPromise.finally(() => {
        removeExitHandler();
      });
    };
    module2.exports = {
      spawnedKill,
      spawnedCancel,
      setupTimeout,
      validateTimeout,
      setExitHandler
    };
  }
});

// node_modules/is-stream/index.js
var require_is_stream = __commonJS({
  "node_modules/is-stream/index.js"(exports2, module2) {
    "use strict";
    var isStream = (stream) => stream !== null && typeof stream === "object" && typeof stream.pipe === "function";
    isStream.writable = (stream) => isStream(stream) && stream.writable !== false && typeof stream._write === "function" && typeof stream._writableState === "object";
    isStream.readable = (stream) => isStream(stream) && stream.readable !== false && typeof stream._read === "function" && typeof stream._readableState === "object";
    isStream.duplex = (stream) => isStream.writable(stream) && isStream.readable(stream);
    isStream.transform = (stream) => isStream.duplex(stream) && typeof stream._transform === "function";
    module2.exports = isStream;
  }
});

// node_modules/get-stream/buffer-stream.js
var require_buffer_stream = __commonJS({
  "node_modules/get-stream/buffer-stream.js"(exports2, module2) {
    "use strict";
    var { PassThrough: PassThroughStream } = require("stream");
    module2.exports = (options) => {
      options = { ...options };
      const { array } = options;
      let { encoding } = options;
      const isBuffer = encoding === "buffer";
      let objectMode = false;
      if (array) {
        objectMode = !(encoding || isBuffer);
      } else {
        encoding = encoding || "utf8";
      }
      if (isBuffer) {
        encoding = null;
      }
      const stream = new PassThroughStream({ objectMode });
      if (encoding) {
        stream.setEncoding(encoding);
      }
      let length = 0;
      const chunks = [];
      stream.on("data", (chunk) => {
        chunks.push(chunk);
        if (objectMode) {
          length = chunks.length;
        } else {
          length += chunk.length;
        }
      });
      stream.getBufferedValue = () => {
        if (array) {
          return chunks;
        }
        return isBuffer ? Buffer.concat(chunks, length) : chunks.join("");
      };
      stream.getBufferedLength = () => length;
      return stream;
    };
  }
});

// node_modules/get-stream/index.js
var require_get_stream = __commonJS({
  "node_modules/get-stream/index.js"(exports2, module2) {
    "use strict";
    var { constants: BufferConstants } = require("buffer");
    var stream = require("stream");
    var { promisify } = require("util");
    var bufferStream = require_buffer_stream();
    var streamPipelinePromisified = promisify(stream.pipeline);
    var MaxBufferError = class extends Error {
      constructor() {
        super("maxBuffer exceeded");
        this.name = "MaxBufferError";
      }
    };
    async function getStream(inputStream, options) {
      if (!inputStream) {
        throw new Error("Expected a stream");
      }
      options = {
        maxBuffer: Infinity,
        ...options
      };
      const { maxBuffer } = options;
      const stream2 = bufferStream(options);
      await new Promise((resolve, reject) => {
        const rejectPromise = (error) => {
          if (error && stream2.getBufferedLength() <= BufferConstants.MAX_LENGTH) {
            error.bufferedData = stream2.getBufferedValue();
          }
          reject(error);
        };
        (async () => {
          try {
            await streamPipelinePromisified(inputStream, stream2);
            resolve();
          } catch (error) {
            rejectPromise(error);
          }
        })();
        stream2.on("data", () => {
          if (stream2.getBufferedLength() > maxBuffer) {
            rejectPromise(new MaxBufferError());
          }
        });
      });
      return stream2.getBufferedValue();
    }
    module2.exports = getStream;
    module2.exports.buffer = (stream2, options) => getStream(stream2, { ...options, encoding: "buffer" });
    module2.exports.array = (stream2, options) => getStream(stream2, { ...options, array: true });
    module2.exports.MaxBufferError = MaxBufferError;
  }
});

// node_modules/merge-stream/index.js
var require_merge_stream = __commonJS({
  "node_modules/merge-stream/index.js"(exports2, module2) {
    "use strict";
    var { PassThrough } = require("stream");
    module2.exports = function() {
      var sources = [];
      var output = new PassThrough({ objectMode: true });
      output.setMaxListeners(0);
      output.add = add;
      output.isEmpty = isEmpty;
      output.on("unpipe", remove);
      Array.prototype.slice.call(arguments).forEach(add);
      return output;
      function add(source) {
        if (Array.isArray(source)) {
          source.forEach(add);
          return this;
        }
        sources.push(source);
        source.once("end", remove.bind(null, source));
        source.once("error", output.emit.bind(output, "error"));
        source.pipe(output, { end: false });
        return this;
      }
      function isEmpty() {
        return sources.length == 0;
      }
      function remove(source) {
        sources = sources.filter(function(it) {
          return it !== source;
        });
        if (!sources.length && output.readable) {
          output.end();
        }
      }
    };
  }
});

// node_modules/execa/lib/stream.js
var require_stream = __commonJS({
  "node_modules/execa/lib/stream.js"(exports2, module2) {
    "use strict";
    var isStream = require_is_stream();
    var getStream = require_get_stream();
    var mergeStream = require_merge_stream();
    var handleInput = (spawned, input) => {
      if (input === void 0 || spawned.stdin === void 0) {
        return;
      }
      if (isStream(input)) {
        input.pipe(spawned.stdin);
      } else {
        spawned.stdin.end(input);
      }
    };
    var makeAllStream = (spawned, { all }) => {
      if (!all || !spawned.stdout && !spawned.stderr) {
        return;
      }
      const mixed = mergeStream();
      if (spawned.stdout) {
        mixed.add(spawned.stdout);
      }
      if (spawned.stderr) {
        mixed.add(spawned.stderr);
      }
      return mixed;
    };
    var getBufferedData = async (stream, streamPromise) => {
      if (!stream) {
        return;
      }
      stream.destroy();
      try {
        return await streamPromise;
      } catch (error) {
        return error.bufferedData;
      }
    };
    var getStreamPromise = (stream, { encoding, buffer, maxBuffer }) => {
      if (!stream || !buffer) {
        return;
      }
      if (encoding) {
        return getStream(stream, { encoding, maxBuffer });
      }
      return getStream.buffer(stream, { maxBuffer });
    };
    var getSpawnedResult = async ({ stdout, stderr, all }, { encoding, buffer, maxBuffer }, processDone) => {
      const stdoutPromise = getStreamPromise(stdout, { encoding, buffer, maxBuffer });
      const stderrPromise = getStreamPromise(stderr, { encoding, buffer, maxBuffer });
      const allPromise = getStreamPromise(all, { encoding, buffer, maxBuffer: maxBuffer * 2 });
      try {
        return await Promise.all([processDone, stdoutPromise, stderrPromise, allPromise]);
      } catch (error) {
        return Promise.all([
          { error, signal: error.signal, timedOut: error.timedOut },
          getBufferedData(stdout, stdoutPromise),
          getBufferedData(stderr, stderrPromise),
          getBufferedData(all, allPromise)
        ]);
      }
    };
    var validateInputSync = ({ input }) => {
      if (isStream(input)) {
        throw new TypeError("The `input` option cannot be a stream in sync mode");
      }
    };
    module2.exports = {
      handleInput,
      makeAllStream,
      getSpawnedResult,
      validateInputSync
    };
  }
});

// node_modules/execa/lib/promise.js
var require_promise = __commonJS({
  "node_modules/execa/lib/promise.js"(exports2, module2) {
    "use strict";
    var nativePromisePrototype = (async () => {
    })().constructor.prototype;
    var descriptors = ["then", "catch", "finally"].map((property) => [
      property,
      Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)
    ]);
    var mergePromise = (spawned, promise) => {
      for (const [property, descriptor] of descriptors) {
        const value = typeof promise === "function" ? (...args) => Reflect.apply(descriptor.value, promise(), args) : descriptor.value.bind(promise);
        Reflect.defineProperty(spawned, property, { ...descriptor, value });
      }
      return spawned;
    };
    var getSpawnedPromise = (spawned) => {
      return new Promise((resolve, reject) => {
        spawned.on("exit", (exitCode, signal) => {
          resolve({ exitCode, signal });
        });
        spawned.on("error", (error) => {
          reject(error);
        });
        if (spawned.stdin) {
          spawned.stdin.on("error", (error) => {
            reject(error);
          });
        }
      });
    };
    module2.exports = {
      mergePromise,
      getSpawnedPromise
    };
  }
});

// node_modules/execa/lib/command.js
var require_command = __commonJS({
  "node_modules/execa/lib/command.js"(exports2, module2) {
    "use strict";
    var normalizeArgs = (file, args = []) => {
      if (!Array.isArray(args)) {
        return [file];
      }
      return [file, ...args];
    };
    var NO_ESCAPE_REGEXP = /^[\w.-]+$/;
    var DOUBLE_QUOTES_REGEXP = /"/g;
    var escapeArg = (arg) => {
      if (typeof arg !== "string" || NO_ESCAPE_REGEXP.test(arg)) {
        return arg;
      }
      return `"${arg.replace(DOUBLE_QUOTES_REGEXP, '\\"')}"`;
    };
    var joinCommand = (file, args) => {
      return normalizeArgs(file, args).join(" ");
    };
    var getEscapedCommand = (file, args) => {
      return normalizeArgs(file, args).map((arg) => escapeArg(arg)).join(" ");
    };
    var SPACES_REGEXP = / +/g;
    var parseCommand = (command) => {
      const tokens = [];
      for (const token of command.trim().split(SPACES_REGEXP)) {
        const previousToken = tokens[tokens.length - 1];
        if (previousToken && previousToken.endsWith("\\")) {
          tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`;
        } else {
          tokens.push(token);
        }
      }
      return tokens;
    };
    module2.exports = {
      joinCommand,
      getEscapedCommand,
      parseCommand
    };
  }
});

// node_modules/execa/index.js
var require_execa = __commonJS({
  "node_modules/execa/index.js"(exports2, module2) {
    "use strict";
    var path2 = require("path");
    var childProcess = require("child_process");
    var crossSpawn = require_cross_spawn();
    var stripFinalNewline = require_strip_final_newline();
    var npmRunPath = require_npm_run_path();
    var onetime = require_onetime();
    var makeError = require_error();
    var normalizeStdio = require_stdio();
    var { spawnedKill, spawnedCancel, setupTimeout, validateTimeout, setExitHandler } = require_kill();
    var { handleInput, getSpawnedResult, makeAllStream, validateInputSync } = require_stream();
    var { mergePromise, getSpawnedPromise } = require_promise();
    var { joinCommand, parseCommand, getEscapedCommand } = require_command();
    var DEFAULT_MAX_BUFFER = 1e3 * 1e3 * 100;
    var getEnv = ({ env: envOption, extendEnv, preferLocal, localDir, execPath }) => {
      const env = extendEnv ? { ...process.env, ...envOption } : envOption;
      if (preferLocal) {
        return npmRunPath.env({ env, cwd: localDir, execPath });
      }
      return env;
    };
    var handleArguments = (file, args, options = {}) => {
      const parsed = crossSpawn._parse(file, args, options);
      file = parsed.command;
      args = parsed.args;
      options = parsed.options;
      options = {
        maxBuffer: DEFAULT_MAX_BUFFER,
        buffer: true,
        stripFinalNewline: true,
        extendEnv: true,
        preferLocal: false,
        localDir: options.cwd || process.cwd(),
        execPath: process.execPath,
        encoding: "utf8",
        reject: true,
        cleanup: true,
        all: false,
        windowsHide: true,
        ...options
      };
      options.env = getEnv(options);
      options.stdio = normalizeStdio(options);
      if (process.platform === "win32" && path2.basename(file, ".exe") === "cmd") {
        args.unshift("/q");
      }
      return { file, args, options, parsed };
    };
    var handleOutput = (options, value, error) => {
      if (typeof value !== "string" && !Buffer.isBuffer(value)) {
        return error === void 0 ? void 0 : "";
      }
      if (options.stripFinalNewline) {
        return stripFinalNewline(value);
      }
      return value;
    };
    var execa3 = (file, args, options) => {
      const parsed = handleArguments(file, args, options);
      const command = joinCommand(file, args);
      const escapedCommand = getEscapedCommand(file, args);
      validateTimeout(parsed.options);
      let spawned;
      try {
        spawned = childProcess.spawn(parsed.file, parsed.args, parsed.options);
      } catch (error) {
        const dummySpawned = new childProcess.ChildProcess();
        const errorPromise = Promise.reject(makeError({
          error,
          stdout: "",
          stderr: "",
          all: "",
          command,
          escapedCommand,
          parsed,
          timedOut: false,
          isCanceled: false,
          killed: false
        }));
        return mergePromise(dummySpawned, errorPromise);
      }
      const spawnedPromise = getSpawnedPromise(spawned);
      const timedPromise = setupTimeout(spawned, parsed.options, spawnedPromise);
      const processDone = setExitHandler(spawned, parsed.options, timedPromise);
      const context = { isCanceled: false };
      spawned.kill = spawnedKill.bind(null, spawned.kill.bind(spawned));
      spawned.cancel = spawnedCancel.bind(null, spawned, context);
      const handlePromise = async () => {
        const [{ error, exitCode, signal, timedOut }, stdoutResult, stderrResult, allResult] = await getSpawnedResult(spawned, parsed.options, processDone);
        const stdout = handleOutput(parsed.options, stdoutResult);
        const stderr = handleOutput(parsed.options, stderrResult);
        const all = handleOutput(parsed.options, allResult);
        if (error || exitCode !== 0 || signal !== null) {
          const returnedError = makeError({
            error,
            exitCode,
            signal,
            stdout,
            stderr,
            all,
            command,
            escapedCommand,
            parsed,
            timedOut,
            isCanceled: context.isCanceled,
            killed: spawned.killed
          });
          if (!parsed.options.reject) {
            return returnedError;
          }
          throw returnedError;
        }
        return {
          command,
          escapedCommand,
          exitCode: 0,
          stdout,
          stderr,
          all,
          failed: false,
          timedOut: false,
          isCanceled: false,
          killed: false
        };
      };
      const handlePromiseOnce = onetime(handlePromise);
      handleInput(spawned, parsed.options.input);
      spawned.all = makeAllStream(spawned, parsed.options);
      return mergePromise(spawned, handlePromiseOnce);
    };
    module2.exports = execa3;
    module2.exports.sync = (file, args, options) => {
      const parsed = handleArguments(file, args, options);
      const command = joinCommand(file, args);
      const escapedCommand = getEscapedCommand(file, args);
      validateInputSync(parsed.options);
      let result;
      try {
        result = childProcess.spawnSync(parsed.file, parsed.args, parsed.options);
      } catch (error) {
        throw makeError({
          error,
          stdout: "",
          stderr: "",
          all: "",
          command,
          escapedCommand,
          parsed,
          timedOut: false,
          isCanceled: false,
          killed: false
        });
      }
      const stdout = handleOutput(parsed.options, result.stdout, result.error);
      const stderr = handleOutput(parsed.options, result.stderr, result.error);
      if (result.error || result.status !== 0 || result.signal !== null) {
        const error = makeError({
          stdout,
          stderr,
          error: result.error,
          signal: result.signal,
          exitCode: result.status,
          command,
          escapedCommand,
          parsed,
          timedOut: result.error && result.error.code === "ETIMEDOUT",
          isCanceled: false,
          killed: result.signal !== null
        });
        if (!parsed.options.reject) {
          return error;
        }
        throw error;
      }
      return {
        command,
        escapedCommand,
        exitCode: 0,
        stdout,
        stderr,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false
      };
    };
    module2.exports.command = (command, options) => {
      const [file, ...args] = parseCommand(command);
      return execa3(file, args, options);
    };
    module2.exports.commandSync = (command, options) => {
      const [file, ...args] = parseCommand(command);
      return execa3.sync(file, args, options);
    };
    module2.exports.node = (scriptPath, args, options = {}) => {
      if (args && !Array.isArray(args) && typeof args === "object") {
        options = args;
        args = [];
      }
      const stdio = normalizeStdio.node(options);
      const defaultExecArgv = process.execArgv.filter((arg) => !arg.startsWith("--inspect"));
      const {
        nodePath = process.execPath,
        nodeOptions = defaultExecArgv
      } = options;
      return execa3(
        nodePath,
        [
          ...nodeOptions,
          scriptPath,
          ...Array.isArray(args) ? args : []
        ],
        {
          ...options,
          stdin: void 0,
          stdout: void 0,
          stderr: void 0,
          stdio,
          shell: false
        }
      );
    };
  }
});

// electron/main.ts
var import_electron_log2 = __toESM(require("electron-log"), 1);
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_execa2 = __toESM(require_execa(), 1);

// electron/extractor.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_execa = __toESM(require_execa(), 1);
var import_playwright_core = require("playwright-core");

// electron/url-analyser.ts
var YTDLP_NATIVE = [
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "vimeo.com",
  "reddit.com",
  "dailymotion.com",
  "vk.com",
  "twitch.tv",
  "vlive.tv",
  "bilibili.com",
  "nicovideo.jp",
  "rumble.com",
  "bitchute.com",
  "brightcove.com",
  "odysee.com",
  "peer-tube.org"
];
var ANIME_STREAMING = [
  "crunchyroll.com",
  "funimation.com",
  "hidive.com",
  "vrv.co",
  "animelab.com",
  "anime-planet.com",
  "gogoanime.vc",
  "9anime.to",
  "kissanime.ru",
  "viz.com"
];
var GALLERY_DL_NATIVE = [
  "deviantart.com",
  "pixiv.net",
  "artstation.com",
  "flickr.com",
  "imgur.com",
  "pinterest.com",
  "tumblr.com",
  "danbooru.donmai.us",
  "gelbooru.com",
  "yande.re"
];
var STREAMLINK_NATIVE = [
  "twitch.tv",
  "youtube.com/live",
  "kick.com",
  "trovo.live",
  "afreecatv.com",
  "dlive.tv",
  "mixer.com",
  "bigo.tv",
  "nonolive.com",
  "spooncast.net"
];
function analyseUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace("www.", "");
    const path2 = parsed.pathname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
    }
    let engineOrder = ["yt-dlp", "playwright"];
    if (YTDLP_NATIVE.some((h) => host.includes(h))) {
      engineOrder = ["yt-dlp", "playwright"];
    } else if (ANIME_STREAMING.some((h) => host.includes(h))) {
      engineOrder = ["n-m3u8dl", "yt-dlp", "playwright"];
    } else if (GALLERY_DL_NATIVE.some((h) => host.includes(h))) {
      engineOrder = ["gallery-dl", "yt-dlp", "playwright"];
    } else if (STREAMLINK_NATIVE.some((h) => host.includes(h))) {
      engineOrder = ["streamlink", "yt-dlp", "playwright"];
    }
    return {
      engineOrder,
      isPlaylist: parsed.searchParams.has("list")
    };
  } catch (error) {
    if (error.message.includes("valid URL")) throw error;
    throw new Error("Please enter a valid URL");
  }
}

// electron/extractor.ts
var import_electron_log = __toESM(require("electron-log"), 1);

// electron/ytdlp-args.ts
var import_fs = __toESM(require("fs"), 1);
function ytDlpCookiesArgs(cookiesFile) {
  if (typeof cookiesFile !== "string") return [];
  const t = cookiesFile.trim();
  if (!t) return [];
  try {
    if (import_fs.default.existsSync(t)) return ["--cookies", t];
  } catch {
  }
  return [];
}
function isYouTubeUrl(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" || h.endsWith(".youtu.be");
  } catch {
    return false;
  }
}
function ytDlpCommonArgs(url, options) {
  const args = ["--age-limit", "99"];
  if (options.noPlaylist) {
    args.push("--no-playlist");
  }
  if (isYouTubeUrl(url)) {
    const client = options.youtubePlayerClient ?? "android";
    args.push("--extractor-args", `youtube:player_client=${client}`);
  }
  return args;
}

// electron/errors.ts
function isLikelyYoutubeAgeRestrictionError(raw) {
  const m = (raw || "").toLowerCase();
  if (m.includes("age-restricted") || m.includes("age restricted") || m.includes("confirm your age") || m.includes("inappropriate for some users") || m.includes("this video may be inappropriate") || m.includes("video is age restricted") || m.includes("content is age restricted") || m.includes("restricted from embedding") || m.includes("age_limit")) {
    return true;
  }
  const signInAgePattern = /(?:sign\s*in|login|log\s*in).*(?:age|age\s*restricted|18\+|adult)/i;
  const ageSignInPattern = /(?:age|age\s*restricted|18\+|adult).*(?:sign\s*in|login|log\s*in)/i;
  return signInAgePattern.test(m) || ageSignInPattern.test(m);
}
function translateDownloadError(rawError, exitCode, url) {
  const msg = (rawError || "").toLowerCase();
  const domain = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "this site";
    }
  })();
  if (msg.includes("network") || msg.includes("connection") || msg.includes("connect") || msg.includes("unreachable") || msg.includes("timeout") || msg.includes("timed out") || msg.includes("no route") || msg.includes("enotfound") || exitCode === 1 && msg.includes("unable to download")) {
    return "No internet connection. Please check your connection and try again.";
  }
  if (msg.includes("getaddrinfo") || msg.includes("socket hang up") || msg.includes("econnrefused") || msg.includes("econnreset") || msg.includes("etimedout")) {
    return "Could not connect to the internet. Please check your connection and try again.";
  }
  if (msg.includes("private video") || msg.includes("this video is private")) {
    return "This video is private and cannot be downloaded.";
  }
  if (isLikelyYoutubeAgeRestrictionError(rawError)) {
    return "The host site is blocking this link until you sign in there (common on YouTube for some videos). In Settings \u2192 Age eligibility & site sign-in, add a cookies file exported from your browser while logged in, then try again. You can also update yt-dlp in Settings or use another URL for the same content.";
  }
  if (msg.includes("video unavailable") || msg.includes("has been removed") || msg.includes("no longer available") || msg.includes("deleted")) {
    return "This video has been removed or is no longer available.";
  }
  if (msg.includes("not available in your country") || msg.includes("geo") || msg.includes("blocked in")) {
    return "This video is not available in your region.";
  }
  if (msg.includes("drm") || msg.includes("widevine") || msg.includes("encrypted")) {
    return "This video is protected by DRM and cannot be downloaded.";
  }
  if (msg.includes("copyright") || msg.includes("content warning")) {
    return "This video has been blocked due to a copyright claim.";
  }
  if (msg.includes("login") || msg.includes("please log in") || msg.includes("authentication") || msg.includes("not logged in")) {
    return "This video requires you to be logged in. It cannot be downloaded.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429")) {
    return "Too many requests were sent. Please wait a few minutes and try again.";
  }
  if (msg.includes("unsupported url") || msg.includes("is not supported") || msg.includes("no video formats found")) {
    return `${domain} is not supported yet. Try updating yt-dlp in Settings or use a different link.`;
  }
  if (msg.includes("requested format is not available") || msg.includes("format not available")) {
    return "The selected quality is not available for this video. Please choose a different quality.";
  }
  if (msg.includes("no space left") || msg.includes("disk full") || msg.includes("not enough space")) {
    return "Not enough storage space. Please free up space and try again.";
  }
  if (msg.includes("permission denied") || msg.includes("access denied") || msg.includes("eperm")) {
    return "Permission denied. Please check that the save folder is accessible and try again.";
  }
  if (msg.includes("ffmpeg") && msg.includes("not found")) {
    return "A required component (FFmpeg) is missing. Please reinstall the app.";
  }
  if (exitCode === 1) {
    return `The download failed. Please check your internet connection and try again. If the problem continues, try updating yt-dlp in Settings.`;
  }
  if (exitCode === 2) {
    return "The download was cancelled.";
  }
  return `Could not download from ${domain}. Please check your internet connection and try again. If the problem continues, try a different link or update yt-dlp in Settings.`;
}

// electron/extractor.ts
async function extractVideoInfo(url, paths) {
  const { engineOrder } = analyseUrl(url);
  import_electron_log.default.info(`[Extractor] Engine order for ${url}: ${engineOrder.join(", ")}`);
  let lastError = null;
  for (const engine of engineOrder) {
    try {
      import_electron_log.default.info(`[Extractor] Trying engine: ${engine}...`);
      let result;
      switch (engine) {
        case "yt-dlp":
          result = await runYtDlp(url, paths.ytDlp, paths.cookiesFile);
          break;
        case "streamlink":
          result = await runStreamlink(url, paths.streamlink);
          break;
        case "n-m3u8dl":
          result = await runNm3u8dl(url, paths.nm3u8dl);
          break;
        case "gallery-dl":
          result = await runGalleryDl(url, paths.galleryDl);
          break;
        case "playwright":
          result = await extractWithPlaywright(url, paths.ytDlp, paths.cookiesFile);
          break;
        default:
          continue;
      }
      import_electron_log.default.info(`[Extractor] Success with engine: ${engine}`);
      return result;
    } catch (err) {
      import_electron_log.default.warn(`[Extractor] Engine ${engine} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All extraction engines failed.");
}
var YT_DLP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function buildYtDlpJsonArgs(url, cookiesFile, youtubeClient) {
  return [
    "-J",
    "--no-warnings",
    "--user-agent",
    YT_DLP_UA,
    "--add-header",
    "Accept-Language:en-US,en;q=0.9",
    ...ytDlpCommonArgs(url, {
      noPlaylist: true,
      ...youtubeClient !== void 0 ? { youtubePlayerClient: youtubeClient } : {}
    }),
    ...ytDlpCookiesArgs(cookiesFile),
    url
  ];
}
function parseYtDlpJsonStdout(stdout, pageUrl) {
  const info = JSON.parse(stdout);
  if (info._type === "playlist" && Array.isArray(info.entries)) {
    return info.entries.map(
      (entry) => parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, pageUrl)
    );
  }
  return parseYtDlpInfo(info, pageUrl);
}
async function runYtDlp(url, ytDlpPath2, cookiesFile) {
  if (!import_fs2.default.existsSync(ytDlpPath2)) throw new Error("yt-dlp not found");
  try {
    const result = await (0, import_execa.default)(ytDlpPath2, buildYtDlpJsonArgs(url, cookiesFile), { timeout: 12e4 });
    return parseYtDlpJsonStdout(result.stdout, url);
  } catch (err) {
    const stderr = String(err.stderr ?? err.message ?? "");
    if (isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(stderr)) {
      import_electron_log.default.info("[Extractor] Retrying yt-dlp info with youtube:player_client=tv_embedded");
      const result = await (0, import_execa.default)(ytDlpPath2, buildYtDlpJsonArgs(url, cookiesFile, "tv_embedded"), {
        timeout: 12e4
      });
      return parseYtDlpJsonStdout(result.stdout, url);
    }
    throw err;
  }
}
async function runStreamlink(url, streamlinkPath2) {
  if (!import_fs2.default.existsSync(streamlinkPath2)) throw new Error("streamlink not found");
  const result = await (0, import_execa.default)(streamlinkPath2, [url, "--json"], { timeout: 3e4 });
  const info = JSON.parse(result.stdout);
  if (info.error) throw new Error(info.error);
  const streams = info.streams || {};
  const bestStream = streams.best || Object.values(streams)[0];
  if (!bestStream) throw new Error("No streams found for this URL.");
  return {
    url,
    title: info.metadata?.title || "Live Stream",
    thumbnail: info.metadata?.thumbnail || "",
    duration: 0,
    uploader: info.metadata?.author || new URL(url).hostname,
    extractionMethod: "streamlink",
    formats: [{
      formatId: "best",
      label: "Live Stream (Best)",
      quality: "best",
      ext: "ts",
      filesize: null,
      height: null
    }]
  };
}
async function runNm3u8dl(url, nm3u8dlPath) {
  if (!import_fs2.default.existsSync(nm3u8dlPath)) throw new Error("N_m3u8DL-RE not found");
  throw new Error("N_m3u8DL-RE extraction not fully implemented \u2014 use as download engine only.");
}
async function runGalleryDl(url, galleryDlPath2) {
  if (!import_fs2.default.existsSync(galleryDlPath2)) throw new Error("gallery-dl not found");
  const result = await (0, import_execa.default)(galleryDlPath2, ["-j", url], { timeout: 3e4 });
  const info = JSON.parse(result.stdout);
  return {
    url,
    title: "Image Gallery",
    thumbnail: Array.isArray(info) ? info[0]?.url || "" : "",
    duration: 0,
    uploader: new URL(url).hostname,
    extractionMethod: "gallery-dl",
    formats: [{
      formatId: "best",
      label: "Full Quality Gallery",
      quality: "best",
      ext: "zip",
      filesize: null,
      height: null
    }]
  };
}
async function execYtDlpPlaylistJson(ytDlpPath2, pageUrl, opts) {
  const args = [
    "-J",
    "--no-warnings",
    "--user-agent",
    YT_DLP_UA,
    "--add-header",
    "Accept-Language:en-US,en;q=0.9",
    ...ytDlpCommonArgs(pageUrl, {
      noPlaylist: false,
      ...opts.youtubePlayerClient !== void 0 ? { youtubePlayerClient: opts.youtubePlayerClient } : {}
    }),
    ...ytDlpCookiesArgs(opts.cookiesFile)
  ];
  if (opts.playlistItemLimit && Number.isFinite(opts.playlistItemLimit)) {
    args.push("--playlist-items", String(opts.playlistItemLimit));
  }
  args.push(pageUrl);
  return (0, import_execa.default)(ytDlpPath2, args, { timeout: 12e4 });
}
async function extractPlaylistInfo(url, paths, opts) {
  let result;
  try {
    result = await execYtDlpPlaylistJson(paths.ytDlp, url, {
      playlistItemLimit: opts?.playlistItemLimit,
      cookiesFile: paths.cookiesFile
    });
  } catch (err) {
    const stderr = String(err.stderr ?? err.message ?? "");
    if (isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(stderr)) {
      import_electron_log.default.info("[Extractor] Retrying playlist yt-dlp with youtube:player_client=tv_embedded");
      result = await execYtDlpPlaylistJson(paths.ytDlp, url, {
        playlistItemLimit: opts?.playlistItemLimit,
        youtubePlayerClient: "tv_embedded",
        cookiesFile: paths.cookiesFile
      });
    } else {
      throw err;
    }
  }
  const info = JSON.parse(result.stdout);
  if (info?._type !== "playlist" || !Array.isArray(info.entries)) {
    throw new Error("This URL does not appear to be a playlist.");
  }
  const videos = info.entries.map(
    (entry) => parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, url)
  );
  return {
    title: info.title || "Playlist",
    uploader: info.uploader || info.channel || "",
    videoCount: info.playlist_count || videos.length,
    videos
  };
}
async function extractWithPlaywright(pageUrl, ytDlpPath2, cookiesFile) {
  const browserPath = import_playwright_core.chromium.executablePath();
  if (!import_fs2.default.existsSync(browserPath)) {
    throw new Error(
      "This site requires deeper analysis but the browser component is not installed yet. Please restart the app to trigger automatic installation, or try a YouTube link instead."
    );
  }
  const browser = await import_playwright_core.chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled"
    ]
  });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    const capturedUrls = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes(".m3u8") || url.includes("manifest") || url.includes(".mpd")) {
        console.log("[Playwright] Captured manifest URL:", url);
        capturedUrls.push(url);
      }
      if (url.match(/\.(mp4|webm|mkv|avi|mov)(\?|$)/i)) {
        console.log("[Playwright] Captured video URL:", url);
        capturedUrls.push(url);
      }
    });
    page.on("response", async (response) => {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("video/") || contentType.includes("application/x-mpegURL") || contentType.includes("application/vnd.apple.mpegurl") || contentType.includes("application/dash+xml")) {
        console.log("[Playwright] Captured by content-type:", url);
        capturedUrls.push(url);
      }
    });
    console.log("[Playwright] Loading page:", pageUrl);
    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 3e4
    });
    await page.waitForTimeout(3e3);
    const playSelectors = [
      'button[class*="play"]',
      ".play-button",
      ".jw-icon-playback",
      ".plyr__control--overlaid",
      '[aria-label*="play" i]',
      "video"
    ];
    for (const selector of playSelectors) {
      try {
        await page.click(selector, { timeout: 2e3 });
        console.log("[Playwright] Clicked play button:", selector);
        await page.waitForTimeout(3e3);
        break;
      } catch {
      }
    }
    const metadata = await page.evaluate(() => ({
      title: document.title || document.querySelector("h1")?.textContent || document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "Unknown Title",
      thumbnail: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || document.querySelector("video")?.getAttribute("poster") || "",
      duration: (() => {
        const video = document.querySelector("video");
        return video?.duration || 0;
      })()
    }));
    await browser.close();
    if (capturedUrls.length === 0) {
      throw new Error("Could not find any video stream on this page. The site may require login or use DRM protection.");
    }
    const bestUrl = capturedUrls.find((u) => u.includes(".m3u8")) || capturedUrls.find((u) => u.includes(".mpd")) || capturedUrls[0];
    console.log("[Playwright] Best extracted URL:", bestUrl);
    try {
      const result = await (0, import_execa.default)(ytDlpPath2, [
        "--dump-json",
        "--no-warnings",
        ...ytDlpCommonArgs(bestUrl, { noPlaylist: true }),
        ...ytDlpCookiesArgs(cookiesFile),
        bestUrl
      ], { timeout: 15e3 });
      const info = JSON.parse(result.stdout);
      return {
        ...parseYtDlpInfo(info, bestUrl),
        title: metadata.title || info.title || "Extracted Video",
        thumbnail: metadata.thumbnail || info.thumbnail || "",
        extractedUrl: bestUrl,
        extractionMethod: "playwright"
      };
    } catch {
      return {
        url: bestUrl,
        title: metadata.title || "Extracted Video",
        thumbnail: metadata.thumbnail || "",
        duration: metadata.duration || 0,
        uploader: new URL(pageUrl).hostname,
        extractedUrl: bestUrl,
        extractionMethod: "playwright",
        formats: [
          {
            formatId: "best",
            label: "Best Available Quality",
            quality: "best",
            ext: bestUrl.includes(".m3u8") ? "mp4" : "mp4",
            filesize: null,
            height: null
          }
        ]
      };
    }
  } catch (error) {
    await browser.close();
    throw error;
  }
}
function parseYtDlpInfo(info, fallbackUrl) {
  const resolvedUrl = info?.webpage_url || info?.url || info?.original_url || fallbackUrl;
  const formats = (info.formats || []).filter((f) => f.height && (f.acodec !== "none" || f.vcodec !== "none")).map((f) => ({
    formatId: f.format_id,
    label: `${f.height}p ${f.ext?.toUpperCase() || ""} ${f.filesize || f.filesize_approx ? "(" + formatBytes(f.filesize || f.filesize_approx) + ")" : ""}`.trim(),
    quality: `${f.height}p`,
    ext: f.ext,
    filesize: f.filesize || f.filesize_approx || null,
    height: f.height
  })).sort((a, b) => (b.height || 0) - (a.height || 0));
  const seen = /* @__PURE__ */ new Set();
  const uniqueFormats = formats.filter((f) => {
    if (seen.has(f.height)) return false;
    seen.add(f.height);
    return true;
  });
  return {
    url: resolvedUrl,
    title: info.title || "Unknown Video",
    thumbnail: info.thumbnail || "",
    duration: info.duration || 0,
    uploader: info.uploader || info.channel || "",
    extractionMethod: "yt-dlp",
    formats: [
      { formatId: "bestvideo+bestaudio", label: "Best Quality (Recommended)", quality: "best", ext: "mp4", filesize: null, height: null },
      ...uniqueFormats,
      { formatId: "bestaudio", label: "Audio Only (MP3)", quality: "audio", ext: "mp3", filesize: null, height: null }
    ]
  };
}
function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// electron/main.ts
var import_fs3 = __toESM(require("fs"), 1);
var import_os = __toESM(require("os"), 1);
var import_https = __toESM(require("https"), 1);
var import_sql = __toESM(require("sql.js"), 1);
import_electron_log2.default.transports.file.level = "debug";
import_electron_log2.default.catchErrors();
try {
  const fileTransport = import_electron_log2.default.transports.file;
  const p = fileTransport.getFile?.()?.path;
  import_electron_log2.default.info("[Main] electron-log file path:", p ?? "(default location)");
} catch {
  import_electron_log2.default.info("[Main] electron-log initialized");
}
var DB_PATH;
process.env.VITE_ELECTRON = "true";
var mainWindow = null;
var tray = null;
var db;
var activeTasks = /* @__PURE__ */ new Map();
var taskStopReasons = /* @__PURE__ */ new Map();
var powerSaveBlockerId = null;
var isDev;
var isTest;
var binariesPath;
var ytDlpPath;
var ffmpegPath;
var ffprobePath;
var streamlinkPath;
var n_m3u8dlPath;
var galleryDlPath;
isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
function initializeSingleInstanceLock() {
  if (!isDev) {
    const gotTheLock = import_electron.app.requestSingleInstanceLock();
    if (!gotTheLock) {
      import_electron_log2.default.info("[Main] Another instance is running \u2014 focusing it and exiting");
      import_electron.app.quit();
      return false;
    }
    import_electron.app.on("second-instance", () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  } else {
    import_electron_log2.default.info("[Main] Development mode detected \u2014 single-instance lock disabled");
  }
  return true;
}
function setupPaths() {
  isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
  isTest = process.env.NODE_ENV === "test";
  const userDataBinariesPath = import_path.default.join(import_electron.app.getPath("userData"), "binaries");
  binariesPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "binaries") : import_path.default.join(process.cwd(), "binaries");
  const getBinaryPath = (name) => {
    const userPath = import_path.default.join(userDataBinariesPath, name);
    if (import_fs3.default.existsSync(userPath)) {
      import_electron_log2.default.info(`[Main] Using ${name} from userData: ${userPath}`);
      return userPath;
    }
    const pkgPath = import_path.default.join(binariesPath, name);
    import_electron_log2.default.info(`[Main] Using ${name} from resources: ${pkgPath}`);
    return pkgPath;
  };
  ytDlpPath = getBinaryPath("yt-dlp.exe");
  ffmpegPath = getBinaryPath("ffmpeg.exe");
  ffprobePath = getBinaryPath("ffprobe.exe");
  streamlinkPath = getBinaryPath("streamlink.exe");
  n_m3u8dlPath = getBinaryPath("N_m3u8DL-RE.exe");
  galleryDlPath = getBinaryPath("gallery-dl.exe");
}
function checkBinaries() {
  setupPaths();
  const binaries = [
    { name: "yt-dlp", path: ytDlpPath },
    { name: "ffmpeg", path: ffmpegPath },
    { name: "ffprobe", path: ffprobePath },
    { name: "streamlink", path: streamlinkPath },
    { name: "N_m3u8DL-RE", path: n_m3u8dlPath },
    { name: "gallery-dl", path: galleryDlPath }
  ];
  import_electron_log2.default.info("[MAIN] === BINARY VERIFICATION ===");
  import_electron_log2.default.info("[MAIN] Binaries path:", binariesPath);
  import_electron_log2.default.info("[MAIN] App packaged:", import_electron.app.isPackaged);
  let missingCount = 0;
  binaries.forEach(({ name, path: path2 }) => {
    if (import_fs3.default.existsSync(path2)) {
      import_electron_log2.default.info(`[BINARY OK] ${name}: ${path2}`);
    } else {
      import_electron_log2.default.error(`[BINARY MISSING] ${name}: ${path2}`);
      missingCount++;
    }
  });
  import_electron_log2.default.info("[MAIN] === END BINARY VERIFICATION ===");
  if (missingCount > 0) {
    import_electron_log2.default.warn(`[MAIN] ${missingCount} binaries missing. Some features may not work.`);
  }
  import_electron_log2.default.info(`[Main] isDev: ${isDev}`);
  import_electron_log2.default.info(`[Main] isPackaged: ${import_electron.app.isPackaged}`);
  import_electron_log2.default.info("[MAIN] Default save path:", import_electron.app.getPath("downloads"));
  binaries.forEach((bin) => {
    if (import_fs3.default.existsSync(bin.path)) {
      import_electron_log2.default.info(`\u2705 ${bin.name} found at: ${bin.path}`);
    } else {
      import_electron_log2.default.error(`\u274C ${bin.name} MISSING at: ${bin.path}`);
    }
  });
  import_electron_log2.default.info("------------------------");
}
function isFFmpegAvailable() {
  const userDataBinariesPath = import_path.default.join(import_electron.app.getPath("userData"), "binaries");
  const userFFmpegPath = import_path.default.join(userDataBinariesPath, "ffmpeg.exe");
  const packagedFFmpegPath = import_path.default.join(process.resourcesPath, "binaries", "ffmpeg.exe");
  const ffmpegAvailable = import_fs3.default.existsSync(userFFmpegPath) || import_fs3.default.existsSync(packagedFFmpegPath);
  import_electron_log2.default.info(`[Main] FFmpeg availability check - userData: ${import_fs3.default.existsSync(userFFmpegPath)}, packaged: ${import_fs3.default.existsSync(packagedFFmpegPath)}`);
  return ffmpegAvailable;
}
async function downloadFFmpeg() {
  const ffmpegDownloaded = getQuery(db, "SELECT ffmpeg_downloaded FROM settings WHERE id = 1")?.ffmpeg_downloaded === 1;
  if (ffmpegDownloaded || isFFmpegAvailable()) {
    import_electron_log2.default.info("[Main] FFmpeg is available, skipping download");
    if (!ffmpegDownloaded && isFFmpegAvailable()) {
      db.run("UPDATE settings SET ffmpeg_downloaded = 1 WHERE id = 1");
      saveDatabase(db);
    }
    return;
  }
  try {
    if (mainWindow) {
      mainWindow.webContents.send("ffmpeg-download-notification", {
        title: "Downloading FFmpeg",
        body: "FFmpeg is being downloaded (~80MB) for high-quality video merging. This only happens once.",
        type: "info"
      });
    }
    const ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
    const userDataPath = import_electron.app.getPath("userData");
    const binariesPath2 = import_path.default.join(userDataPath, "binaries");
    if (!import_fs3.default.existsSync(binariesPath2)) {
      import_fs3.default.mkdirSync(binariesPath2, { recursive: true });
    }
    const zipPath = import_path.default.join(binariesPath2, "ffmpeg.zip");
    if (mainWindow) {
      mainWindow.webContents.send("ffmpeg-download-progress", {
        phase: "downloading",
        percent: 0
      });
    }
    import_electron_log2.default.info("[Main] Starting FFmpeg download from:", ffmpegUrl);
    await downloadFile(ffmpegUrl, zipPath);
    const tempDir = import_path.default.join(binariesPath2, "temp_ffmpeg_extract");
    if (!import_fs3.default.existsSync(tempDir)) {
      import_fs3.default.mkdirSync(tempDir, { recursive: true });
    }
    const { execSync } = require("child_process");
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}'"`, { cwd: binariesPath2 });
    const ffmpegSourcePath = import_path.default.join(tempDir, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe");
    if (import_fs3.default.existsSync(ffmpegSourcePath)) {
      import_fs3.default.copyFileSync(ffmpegSourcePath, import_path.default.join(binariesPath2, "ffmpeg.exe"));
    } else {
      throw new Error("ffmpeg.exe not found in extracted archive");
    }
    import_fs3.default.rmSync(tempDir, { recursive: true, force: true });
    import_fs3.default.unlinkSync(zipPath);
    db.run("UPDATE settings SET ffmpeg_downloaded = 1 WHERE id = 1");
    saveDatabase(db);
    if (mainWindow) {
      mainWindow.webContents.send("ffmpeg-download-progress", {
        phase: "completed",
        percent: 100
      });
      setTimeout(() => {
        mainWindow.webContents.send("ffmpeg-download-notification", {
          title: "FFmpeg Ready",
          body: "FFmpeg has been installed. You can now download videos in high quality.",
          type: "success"
        });
      }, 1e3);
    }
    import_electron_log2.default.info("[Main] FFmpeg download completed successfully");
  } catch (error) {
    import_electron_log2.default.error(`[Main] FFmpeg download failed: ${error.message}`);
    if (mainWindow) {
      mainWindow.webContents.send("ffmpeg-download-progress", {
        phase: "error",
        percent: 0,
        error: error.message
      });
      mainWindow.webContents.send("ffmpeg-download-notification", {
        title: "FFmpeg Download Failed",
        body: `Failed to download FFmpeg: ${error.message}. Please try again later.`,
        type: "error"
      });
    }
  }
}
function checkFFmpegRequired(formatId) {
  if (!formatId) return false;
  return formatId === "bestaudio" || formatId.includes("bestvideo+bestaudio") || formatId.includes("merge");
}
function cleanFilename(filename) {
  return filename.replace(/_{2,}/g, " ").replace(/-{2,}/g, " - ").replace(/__+/g, " ").replace(/\s{2,}/g, " ").replace(/^\s+|\s+$/g, "").replace(/[<>:"/\\|?*]/g, "");
}
function updatePowerSave() {
  if (activeTasks.size > 0) {
    if (powerSaveBlockerId === null) {
      powerSaveBlockerId = import_electron.powerSaveBlocker.start("prevent-app-suspension");
      import_electron_log2.default.info("[PowerSave] Blocking sleep \u2014 downloads active");
    }
  } else {
    if (powerSaveBlockerId !== null) {
      import_electron.powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
      import_electron_log2.default.info("[PowerSave] Allowing sleep \u2014 no active downloads");
    }
  }
}
function updateTaskbarProgress() {
  if (!mainWindow) return;
  if (activeTasks.size === 0) {
    mainWindow.setProgressBar(-1);
    return;
  }
}
function getDefaultSavePath() {
  if (!db) return import_electron.app.getPath("downloads");
  const settings = getQuery(db, "SELECT download_path FROM settings WHERE id = 1");
  if (settings && settings.download_path && import_fs3.default.existsSync(settings.download_path)) {
    return settings.download_path;
  }
  return import_electron.app.getPath("downloads");
}
function saveDatabase(database) {
  if (!database || !DB_PATH) return;
  const data = database.export();
  const buffer = Buffer.from(data);
  import_fs3.default.writeFileSync(DB_PATH, buffer);
}
function getQuery(database, sql, params = []) {
  const result = database.exec(sql, params);
  if (result.length === 0) return null;
  const { columns, values } = result[0];
  const obj = {};
  columns.forEach((col, i) => obj[col] = values[0][i]);
  return obj;
}
function allQuery(database, sql, params = []) {
  const result = database.exec(sql, params);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}
function getSqlJsWasmDir() {
  const unpackedDist = import_path.default.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "sql.js", "dist");
  const insideAsar = import_path.default.join(import_electron.app.getAppPath(), "node_modules", "sql.js", "dist");
  const devCwd = import_path.default.join(process.cwd(), "node_modules", "sql.js", "dist");
  const nextToMain = import_path.default.join(__dirname, "..", "node_modules", "sql.js", "dist");
  const candidates = import_electron.app.isPackaged ? [unpackedDist, insideAsar] : [devCwd, nextToMain, unpackedDist, insideAsar];
  for (const dir of candidates) {
    try {
      if (import_fs3.default.existsSync(import_path.default.join(dir, "sql-wasm.wasm"))) {
        import_electron_log2.default.info("[Main] sql.js WASM directory:", dir, import_electron.app.isPackaged ? "(packaged)" : "(dev)");
        return dir;
      }
    } catch {
    }
  }
  import_electron_log2.default.error("[Main] sql-wasm.wasm not found in candidates:", candidates);
  return candidates[0] ?? devCwd;
}
async function initDb() {
  const wasmDir = getSqlJsWasmDir();
  const SQL = await (0, import_sql.default)({
    locateFile: (file) => import_path.default.join(wasmDir, file)
  });
  DB_PATH = import_path.default.join(import_electron.app.getPath("userData"), "downloads.db");
  if (import_fs3.default.existsSync(DB_PATH)) {
    const fileBuffer = import_fs3.default.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  const defaultPath = import_electron.app.getPath("downloads").replace(/\\/g, "/");
  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      url             TEXT    NOT NULL,
      filename        TEXT    NOT NULL,
      thumbnail       TEXT,
      duration        INTEGER,
      uploader        TEXT,
      mime_type       TEXT,
      total_bytes     INTEGER NOT NULL DEFAULT 0,
      received_bytes  INTEGER NOT NULL DEFAULT 0,
      format_id       TEXT,
      state           TEXT    NOT NULL DEFAULT 'queued',
      error           TEXT,
      save_path       TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at    TEXT,
      playlist_title   TEXT,
      playlist_index   INTEGER,
      playlist_total   INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      id                       INTEGER PRIMARY KEY DEFAULT 1,
      theme                    TEXT NOT NULL DEFAULT 'system',
      max_concurrent_downloads INTEGER NOT NULL DEFAULT 3,
      auto_capture             INTEGER NOT NULL DEFAULT 1,
      file_types               TEXT    NOT NULL DEFAULT '["mp4","mp3","zip","exe","pdf","jpg","png"]',
      download_path            TEXT    NOT NULL DEFAULT '${defaultPath}',
      default_quality          TEXT    NOT NULL DEFAULT 'best',
      default_format           TEXT    NOT NULL DEFAULT 'mp4',
      detect_playlists         INTEGER NOT NULL DEFAULT 1,
      playlist_download_mode  TEXT    NOT NULL DEFAULT 'all',
      create_playlist_folder   INTEGER NOT NULL DEFAULT 1,
      ffmpeg_downloaded         INTEGER NOT NULL DEFAULT 0,
      close_to_tray            INTEGER NOT NULL DEFAULT 1
    );
  `);
  const migrations = [
    `ALTER TABLE downloads ADD COLUMN thumbnail TEXT`,
    `ALTER TABLE downloads ADD COLUMN duration INTEGER`,
    `ALTER TABLE downloads ADD COLUMN uploader TEXT`,
    `ALTER TABLE settings ADD COLUMN default_quality TEXT NOT NULL DEFAULT 'best'`,
    `ALTER TABLE settings ADD COLUMN default_format TEXT NOT NULL DEFAULT 'mp4'`,
    `ALTER TABLE settings ADD COLUMN detect_playlists INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN playlist_download_mode TEXT NOT NULL DEFAULT 'all'`,
    `ALTER TABLE settings ADD COLUMN create_playlist_folder INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN eula_age_acknowledged INTEGER DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN cookies_file_path TEXT DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN ffmpeg_downloaded INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE downloads ADD COLUMN playlist_title TEXT`,
    `ALTER TABLE downloads ADD COLUMN playlist_index INTEGER`,
    `ALTER TABLE downloads ADD COLUMN playlist_total INTEGER`,
    `ALTER TABLE settings ADD COLUMN close_to_tray INTEGER NOT NULL DEFAULT 1`
  ];
  for (const sql of migrations) {
    try {
      db.run(sql);
    } catch (_) {
    }
  }
  db.exec(`
    INSERT OR IGNORE INTO settings (id, max_concurrent_downloads, download_path, default_quality, default_format, detect_playlists, playlist_download_mode, create_playlist_folder, close_to_tray)
    VALUES (1, 3, '${defaultPath}', 'best', 'mp4', 1, 'all', 1, 1);
  `);
  const defaults = {
    theme: "system",
    max_concurrent_downloads: 3,
    auto_capture: 1,
    file_types: '["mp4","mp3","zip","exe","pdf","jpg","png"]',
    download_path: defaultPath,
    default_quality: "best",
    default_format: "mp4",
    detect_playlists: 1,
    playlist_download_mode: "all",
    create_playlist_folder: 1,
    eula_age_acknowledged: 0,
    cookies_file_path: "",
    close_to_tray: 1
  };
  for (const [key, value] of Object.entries(defaults)) {
    try {
      db.run(`UPDATE settings SET ${key} = ? WHERE id = 1 AND (${key} IS NULL OR ${key} = '')`, [value]);
    } catch (_) {
    }
  }
  try {
    db.run("UPDATE downloads SET state = 'paused' WHERE state IN ('downloading', 'merging')");
  } catch (_) {
  }
  saveDatabase(db);
}
async function getFreeSpace(targetPath) {
  return new Promise((resolve) => {
    let cmd;
    if (import_os.default.platform() === "win32") {
      const driveLetter = targetPath.split(":")[0];
      cmd = `powershell -NoProfile -Command "(Get-PSDrive -Name '${driveLetter}').Free"`;
    } else {
      cmd = `df -b1 "${targetPath}" | tail -1 | awk '{print $4}'`;
    }
    const { exec } = require("child_process");
    exec(cmd, (err, stdout) => {
      if (err) {
        import_electron_log2.default.error("Failed to get free space:", err);
        resolve(Number.MAX_SAFE_INTEGER);
        return;
      }
      const parsed = parseInt(stdout.trim().replace(/[^0-9]/g, ""), 10);
      resolve(isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed);
    });
  });
}
function updateDownloadInDb(id, updates) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)} = ?`);
    values.push(val instanceof Date ? val.toISOString() : val);
  }
  if (fields.length > 0) {
    db.run(`UPDATE downloads SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
    saveDatabase(db);
  }
}
function deletePartialFile(savePath) {
  if (!savePath) return;
  try {
    if (import_fs3.default.existsSync(savePath)) {
      import_fs3.default.unlinkSync(savePath);
      import_electron_log2.default.info(`[Cleanup] Deleted partial file: ${savePath}`);
    }
    const partFile = savePath + ".part";
    if (import_fs3.default.existsSync(partFile)) {
      import_fs3.default.unlinkSync(partFile);
      import_electron_log2.default.info(`[Cleanup] Deleted partial file: ${partFile}`);
    }
  } catch (err) {
    import_electron_log2.default.error(`[Cleanup] Failed to delete partial file:`, err);
  }
}
function createTray() {
  const iconPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "assets/icon.ico") : import_path.default.join(process.cwd(), "assets/icon.ico");
  let trayIcon;
  if (import_fs3.default.existsSync(iconPath)) {
    trayIcon = import_electron.nativeImage.createFromPath(iconPath);
  } else {
    trayIcon = import_electron.nativeImage.createEmpty();
  }
  tray = new import_electron.Tray(trayIcon);
  tray.setToolTip("Internet Download Hub");
  const updateTrayMenu = () => {
    const activeCount = activeTasks.size;
    const contextMenu = import_electron.Menu.buildFromTemplate([
      { label: "Internet Download Hub", enabled: false },
      { type: "separator" },
      {
        label: "Show Window",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: activeCount > 0 ? `Active Downloads: ${activeCount}` : "No active downloads",
        enabled: false
      },
      { type: "separator" },
      {
        label: "Pause All Downloads",
        enabled: activeCount > 0,
        click: () => {
          activeTasks.forEach((job, id) => {
            job.process.kill("SIGTERM");
            updateDownloadInDb(id, { state: "paused" });
            if (mainWindow) mainWindow.webContents.send("download-progress", { jobId: String(id), id, phase: "Paused", status: "paused" });
          });
          activeTasks.clear();
          updatePowerSave();
          updateTaskbarProgress();
        }
      },
      {
        label: "Resume All Downloads",
        click: () => {
          const paused = allQuery(db, "SELECT * FROM downloads WHERE state = 'paused' ORDER BY created_at ASC");
          for (const item of paused) {
            updateDownloadInDb(item.id, { state: "queued", error: null });
          }
          processQueue();
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          tray?.destroy();
          import_electron.app.quit();
        }
      }
    ]);
    tray?.setContextMenu(contextMenu);
  };
  updateTrayMenu();
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
  setInterval(updateTrayMenu, 3e3);
}
var getPreloadPath = () => {
  if (import_electron.app.isPackaged) {
    return import_path.default.join(__dirname, "preload.cjs");
  } else {
    return import_path.default.join(process.cwd(), "electron", "preload.cjs");
  }
};
function getPackagedIndexHtmlPath() {
  const candidates = [
    import_path.default.join(__dirname, "..", "dist", "public", "index.html"),
    import_path.default.join(__dirname, "..", "dist", "index.html"),
    import_path.default.join(import_electron.app.getAppPath(), "dist", "public", "index.html"),
    import_path.default.join(import_electron.app.getAppPath(), "dist", "index.html")
  ];
  for (const p of candidates) {
    if (import_fs3.default.existsSync(p)) {
      import_electron_log2.default.info("[MAIN] Loading renderer from:", p);
      return p;
    }
    import_electron_log2.default.warn("[MAIN] index.html not found at:", p);
  }
  const fallback = candidates[0];
  import_electron_log2.default.error("[MAIN] No index.html found; attempting loadFile with:", fallback);
  return fallback;
}
function createWindow() {
  const preloadPath = getPreloadPath();
  import_electron_log2.default.info("[MAIN] Preload path:", preloadPath);
  import_electron_log2.default.info("[MAIN] Preload exists:", import_fs3.default.existsSync(preloadPath));
  const iconPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "assets/icon.png") : import_path.default.join(process.cwd(), "assets/icon.png");
  const splash = new import_electron.BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const splashPath = import_electron.app.isPackaged ? import_path.default.join(process.resourcesPath, "app.asar.unpacked", "dist", "splash.html") : import_path.default.join(process.cwd(), "client", "splash.html");
  if (import_fs3.default.existsSync(splashPath)) {
    splash.loadFile(splashPath);
  } else {
    import_electron_log2.default.warn("[MAIN] Splash screen not found at:", splashPath);
  }
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Internet Download Hub",
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.once("ready-to-show", () => {
    splash.close();
    mainWindow?.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
    const ffmpegDownloaded = getQuery(db, "SELECT ffmpeg_downloaded FROM settings WHERE id = 1")?.ffmpeg_downloaded === 1;
    const ffmpegAvailable = isFFmpegAvailable();
    if (ffmpegAvailable && !ffmpegDownloaded) {
      import_electron_log2.default.info("[Main] FFmpeg is available (bundled), updating database flag");
      db.run("UPDATE settings SET ffmpeg_downloaded = 1 WHERE id = 1");
      saveDatabase(db);
    }
    if (!ffmpegAvailable) {
      import_electron_log2.default.info("[Main] FFmpeg not bundled, user will be notified when needed");
    }
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    import_electron_log2.default.error("[MAIN] did-fail-load", { errorCode, errorDescription, validatedURL });
    const msg = `Failed to load (${errorCode}): ${validatedURL}
${errorDescription}`;
    if (!import_electron.app.isPackaged) {
      import_electron.dialog.showErrorBox("Load Error", msg);
    } else {
      import_electron.dialog.showErrorBox("Internet Download Hub \u2014 load error", `${msg}

If this persists, check the log file from Help or %APPDATA% logs.`);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowed = [
      "https://github.com/Isaac-Onyango-Dev",
      "https://isaac-onyango-dev.github.io"
    ];
    if (allowed.some((prefix) => url.startsWith(prefix))) {
      import_electron.shell.openExternal(url);
    } else {
      import_electron_log2.default.warn(`[MAIN] Blocked external navigation: ${url}`);
    }
    return { action: "deny" };
  });
  mainWindow.on("close", (event) => {
    if (tray && !import_electron.app.isQuitting) {
      const settings = getQuery(db, "SELECT close_to_tray FROM settings WHERE id = 1");
      const shouldCloseToTray = settings ? settings.close_to_tray !== 0 : true;
      if (shouldCloseToTray) {
        event.preventDefault();
        mainWindow?.hide();
      } else {
        import_electron.app.isQuitting = true;
      }
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  const isDevRenderer = !import_electron.app.isPackaged;
  if (isDevRenderer) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(getPackagedIndexHtmlPath());
  }
}
function cleanVideoUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("v") && parsed.searchParams.has("list")) {
      const videoId = parsed.searchParams.get("v");
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}
function detectPlaylist(url) {
  try {
    const parsed = new URL(url);
    const hasV = parsed.searchParams.has("v");
    const hasList = parsed.searchParams.has("list");
    const list = (parsed.searchParams.get("list") || "").toUpperCase();
    const lower = url.toLowerCase();
    if (hasV && hasList) {
      return { isPlaylist: false };
    }
    if (parsed.pathname === "/playlist" && hasList) {
      return { isPlaylist: true };
    }
    if (/youtube\.com\/(c\/|channel\/|user\/|@)/.test(lower)) {
      return { isPlaylist: true };
    }
    if (!hasV && hasList && (list.startsWith("RD") || list.startsWith("FL") || list.startsWith("PL"))) {
      return { isPlaylist: true };
    }
    if (!hasV && hasList) {
      return { isPlaylist: true };
    }
    return { isPlaylist: false };
  } catch {
    return { isPlaylist: false };
  }
}
async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const doGet = (target) => {
      import_https.default.get(target, { headers: { "User-Agent": "Internet-Download-Hub" } }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          doGet(res.headers.location);
          return;
        }
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Failed to parse GitHub API response"));
          }
        });
      }).on("error", reject);
    };
    doGet(url);
  });
}
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const doRequest = (redirectUrl) => {
      import_https.default.get(redirectUrl, { headers: { "User-Agent": "Internet-Download-Hub" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download file (HTTP ${res.statusCode}): ${url}`));
          return;
        }
        const file = import_fs3.default.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", (err) => {
          import_fs3.default.unlink(dest, () => {
          });
          reject(err);
        });
      }).on("error", reject);
    };
    doRequest(url);
  });
}
async function getCurrentYtDlpVersion() {
  try {
    const { stdout, stderr } = await (0, import_execa2.default)(ytDlpPath, ["--version"], { timeout: 1e4 });
    const version = (stdout || stderr || "").trim();
    return version || "unknown";
  } catch {
    return "unknown";
  }
}
async function checkYtDlpVersion() {
  const [currentVersion, release] = await Promise.all([
    getCurrentYtDlpVersion(),
    fetchJson("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
  ]);
  const latestVersion = release.tag_name;
  return {
    updateAvailable: currentVersion !== "unknown" && currentVersion !== latestVersion,
    currentVersion,
    latestVersion
  };
}
var BINARIES = [
  {
    name: "yt-dlp",
    releaseApi: "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
    downloadUrl: (tag) => `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp.exe`,
    versionFlag: "--version",
    fileName: "yt-dlp.exe"
  },
  {
    name: "streamlink",
    releaseApi: "https://api.github.com/repos/streamlink/streamlink/releases/latest",
    downloadUrl: (tag) => `https://github.com/streamlink/streamlink/releases/download/${tag}/streamlink-${tag.replace("v", "")}-py311-x86_64.exe`,
    versionFlag: "--version",
    fileName: "streamlink.exe"
  },
  {
    name: "gallery-dl",
    releaseApi: "https://api.github.com/repos/mikf/gallery-dl/releases/latest",
    downloadUrl: (tag) => `https://github.com/mikf/gallery-dl/releases/download/${tag}/gallery-dl.exe`,
    versionFlag: "--version",
    fileName: "gallery-dl.exe"
  },
  {
    name: "N_m3u8DL-RE",
    releaseApi: "https://api.github.com/repos/nilaoda/N_m3u8DL-RE/releases/latest",
    downloadUrl: (tag) => `https://github.com/nilaoda/N_m3u8DL-RE/releases/download/${tag}/N_m3u8DL-RE_${tag.replace("v", "")}_win-x64.zip`,
    versionFlag: "--version",
    fileName: "N_m3u8DL-RE.exe",
    isZip: true
  }
];
async function performYtDlpUpdate() {
  const release = await fetchJson("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest");
  const latestVersion = release.tag_name;
  const currentVersion = await getCurrentYtDlpVersion();
  if (currentVersion === latestVersion) {
    return { updated: false, version: currentVersion };
  }
  const asset = release.assets.find((a) => a.name === "yt-dlp.exe");
  if (!asset) throw new Error("Could not find yt-dlp.exe in the latest release");
  const userDataBinariesPath = import_path.default.join(import_electron.app.getPath("userData"), "binaries");
  if (!import_fs3.default.existsSync(userDataBinariesPath)) {
    import_fs3.default.mkdirSync(userDataBinariesPath, { recursive: true });
  }
  const destPath = import_path.default.join(userDataBinariesPath, "yt-dlp.exe");
  const tempPath = import_path.default.join(userDataBinariesPath, `yt-dlp-new-${Date.now()}.exe`);
  import_electron_log2.default.info(`[UPDATE] Downloading yt-dlp ${latestVersion} to: ${tempPath}`);
  await downloadFile(asset.browser_download_url, tempPath);
  const stats = import_fs3.default.statSync(tempPath);
  if (stats.size < 10 * 1024 * 1024) {
    import_fs3.default.unlinkSync(tempPath);
    throw new Error(`Downloaded file is suspiciously small (${(stats.size / 1024 / 1024).toFixed(2)} MB) \u2014 aborting`);
  }
  const backupPath = destPath + ".backup";
  try {
    if (import_fs3.default.existsSync(backupPath)) import_fs3.default.unlinkSync(backupPath);
  } catch (_) {
  }
  try {
    if (import_fs3.default.existsSync(destPath)) import_fs3.default.renameSync(destPath, backupPath);
  } catch (_) {
  }
  try {
    import_fs3.default.renameSync(tempPath, destPath);
    try {
      if (import_fs3.default.existsSync(backupPath)) import_fs3.default.unlinkSync(backupPath);
    } catch (_) {
    }
    ytDlpPath = destPath;
    import_electron_log2.default.info(`[UPDATE] yt-dlp successfully updated to v${latestVersion} in userData`);
    return { updated: true, version: latestVersion };
  } catch (err) {
    try {
      if (!import_fs3.default.existsSync(destPath) && import_fs3.default.existsSync(backupPath)) {
        import_fs3.default.renameSync(backupPath, destPath);
      }
    } catch (_) {
    }
    try {
      if (import_fs3.default.existsSync(tempPath)) import_fs3.default.unlinkSync(tempPath);
    } catch (_) {
    }
    throw new Error(`Failed to finalize update: ${err.message}`);
  }
}
async function runBackgroundVersionCheck() {
  try {
    const check = await checkYtDlpVersion();
    if (!mainWindow) return;
    if (check.updateAvailable) {
      import_electron_log2.default.info(`[UPDATE] yt-dlp update available: ${check.currentVersion} -> ${check.latestVersion}`);
      mainWindow.webContents.send("ytdlp-update-available", {
        currentVersion: check.currentVersion,
        latestVersion: check.latestVersion
      });
    } else {
      import_electron_log2.default.info(`[UPDATE] yt-dlp is up to date: ${check.currentVersion}`);
      mainWindow.webContents.send("ytdlp-version-info", {
        currentVersion: check.currentVersion,
        latestVersion: check.latestVersion,
        upToDate: true,
        updateAvailable: false
      });
    }
  } catch (err) {
    import_electron_log2.default.warn("[UPDATE] Background version check failed (silently ignored):", err.message);
  }
}
function processQueue() {
  try {
    const settings = getQuery(db, "SELECT max_concurrent_downloads FROM settings WHERE id = 1");
    const maxConcurrent = settings?.max_concurrent_downloads || 3;
    const activeCount = activeTasks.size;
    if (activeCount >= maxConcurrent) return;
    const toStart = maxConcurrent - activeCount;
    const queuedItems = allQuery(db, "SELECT * FROM downloads WHERE state = 'queued' ORDER BY created_at ASC LIMIT ?", [toStart]);
    for (const item of queuedItems) {
      updateDownloadInDb(item.id, { state: "downloading", error: null });
      spawnDownload(item.id, item.url, item.save_path, item.format_id, !!item.received_bytes);
      if (mainWindow) {
        mainWindow.webContents.send("download-progress", {
          jobId: String(item.id),
          id: item.id,
          phase: "Starting download...",
          status: "downloading"
        });
      }
    }
  } catch (error) {
    import_electron_log2.default.error("[Queue Error]", error);
  }
}
function getResolvedCookiesPath() {
  if (!db) return null;
  try {
    const row = getQuery(db, "SELECT cookies_file_path FROM settings WHERE id = 1");
    const raw = row?.cookies_file_path;
    if (typeof raw === "string" && raw.trim()) {
      const p = raw.trim();
      if (import_fs3.default.existsSync(p)) return p;
      import_electron_log2.default.warn("[Main] cookies_file_path set but file missing:", p);
    }
  } catch (e) {
    import_electron_log2.default.warn("[Main] getResolvedCookiesPath:", e?.message);
  }
  return null;
}
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      const { execSync } = require("child_process");
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch (err) {
    import_electron_log2.default.warn("[Main] Failed to kill process tree for PID", pid);
  }
}
function setupIpcHandlers() {
  import_electron.ipcMain.handle("fetch-video-info", async (_, rawUrl) => {
    import_electron_log2.default.info(`[IPC] fetch-video-info called for: ${rawUrl}`);
    try {
      new URL(rawUrl);
    } catch {
      return { success: false, error: "That doesn't look like a valid URL. Please paste a full video link." };
    }
    try {
      const settings = getQuery(db, "SELECT detect_playlists FROM settings WHERE id = 1");
      const detectPlaylistsEnabled = settings?.detect_playlists === 1;
      const cookiesFile = getResolvedCookiesPath();
      const playlistCheck = detectPlaylist(rawUrl);
      if (playlistCheck.isPlaylist) {
        if (!detectPlaylistsEnabled) {
          const urlToUse2 = cleanVideoUrl(rawUrl);
          const info2 = await extractVideoInfo(urlToUse2, {
            ytDlp: ytDlpPath,
            ffmpeg: ffmpegPath,
            streamlink: streamlinkPath,
            nm3u8dl: n_m3u8dlPath,
            galleryDl: galleryDlPath,
            cookiesFile
          });
          return {
            success: true,
            data: Array.isArray(info2) ? info2[0] : info2,
            meta: {
              playlistDetected: true,
              detectPlaylistsEnabled: false,
              collapsedToSingle: true,
              playlistTitle: "Playlist",
              playlistVideoCount: 0
            }
          };
        }
        const playlist = await extractPlaylistInfo(rawUrl, {
          ytDlp: ytDlpPath,
          ffmpeg: ffmpegPath,
          cookiesFile
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("playlist-detected", {
            title: playlist.title,
            count: playlist.videoCount,
            entries: playlist.videos.map((video, index) => ({
              url: video.url,
              title: video.title,
              thumbnail: video.thumbnail,
              index: index + 1
            }))
          });
        }
        return {
          success: true,
          data: { isPlaylist: true, videos: playlist.videos },
          meta: {
            playlistDetected: true,
            detectPlaylistsEnabled: true,
            collapsedToSingle: false,
            playlistTitle: playlist.title,
            playlistVideoCount: playlist.videoCount
          }
        };
      }
      const urlToUse = cleanVideoUrl(rawUrl);
      const info = await extractVideoInfo(urlToUse, {
        ytDlp: ytDlpPath,
        ffmpeg: ffmpegPath,
        streamlink: streamlinkPath,
        nm3u8dl: n_m3u8dlPath,
        galleryDl: galleryDlPath,
        cookiesFile
      });
      return {
        success: true,
        data: Array.isArray(info) ? info[0] : info,
        meta: {
          playlistDetected: false,
          detectPlaylistsEnabled,
          collapsedToSingle: false
        }
      };
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] fetch-video-info failed: ${error.message}`);
      return {
        success: false,
        error: translateDownloadError(error?.message || String(error), null, rawUrl)
      };
    }
  });
  import_electron.ipcMain.handle("start-download", async (_, options) => {
    import_electron_log2.default.info("[DOWNLOAD] Received start-download request:", options);
    if (!options) {
      throw new Error("No download options provided");
    }
    const url = typeof options.url === "string" && options.url.trim() ? options.url.trim() : null;
    const filename = typeof options.filename === "string" && options.filename.trim() ? options.filename.trim() : null;
    if (!url) throw new Error("Invalid or missing URL");
    if (!filename) throw new Error("Invalid or missing filename");
    const formatId = typeof options.formatId === "string" && options.formatId.trim() ? options.formatId.trim() : null;
    if (checkFFmpegRequired(formatId)) {
      await downloadFFmpeg();
    }
    const optionsSavePath = typeof options.savePath === "string" && options.savePath.trim() ? options.savePath.trim() : void 0;
    const thumbnail = typeof options.thumbnail === "string" && options.thumbnail.trim() ? options.thumbnail.trim() : null;
    const uploader = typeof options.uploader === "string" && options.uploader.trim() ? options.uploader.trim() : null;
    const duration = typeof options.duration === "number" && Number.isFinite(options.duration) ? options.duration : null;
    const saveFolder = optionsSavePath || getDefaultSavePath();
    const outputPath = import_path.default.join(saveFolder, filename);
    import_electron_log2.default.info("Saving download to:", outputPath);
    if (!import_fs3.default.existsSync(saveFolder)) {
      import_fs3.default.mkdirSync(saveFolder, { recursive: true });
    }
    const existing = allQuery(db, "SELECT id, state FROM downloads WHERE url = ? AND state IN ('downloading', 'queued')", [url]);
    if (existing.length > 0) {
      throw new Error("This video is already in your download queue.");
    }
    db.run(`
      INSERT INTO downloads (url, filename, thumbnail, duration, uploader, format_id, state, save_path)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    `, [url, filename, thumbnail ?? null, duration ?? null, uploader ?? null, formatId ?? null, outputPath]);
    saveDatabase(db);
    const info = getQuery(db, "SELECT last_insert_rowid() as id");
    const downloadId = info.id;
    processQueue();
    return { id: downloadId };
  });
  import_electron.ipcMain.handle("restart-download", async (_, id) => {
    const dl = getQuery(db, "SELECT * FROM downloads WHERE id = ?", [id]);
    if (!dl) throw new Error("Download not found");
    const existing = activeTasks.get(id);
    if (existing) {
      killProcessTree(existing.process.pid);
      activeTasks.delete(id);
    }
    updateDownloadInDb(id, { state: "queued", error: null, received_bytes: 0 });
    processQueue();
    return { id };
  });
  import_electron.ipcMain.handle("pause-download", async (_, id) => {
    const numericId = Number(id);
    const job = activeTasks.get(numericId);
    if (job) {
      import_electron_log2.default.info("[PAUSE] Pausing job:", numericId);
      taskStopReasons.set(numericId, "paused");
      updateDownloadInDb(numericId, { state: "paused" });
      killProcessTree(job.process.pid);
      activeTasks.delete(numericId);
      updatePowerSave();
      if (mainWindow) {
        mainWindow.webContents.send("download-progress", {
          jobId: String(numericId),
          id: numericId,
          phase: "Paused",
          status: "paused"
        });
      }
    } else {
      import_electron_log2.default.warn("[PAUSE] No active job found for:", numericId);
      updateDownloadInDb(numericId, { state: "paused" });
    }
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });
  import_electron.ipcMain.handle("resume-download", async (_, id) => {
    const numericId = Number(id);
    import_electron_log2.default.info("[RESUME] Resuming job:", numericId);
    const dl = getQuery(db, "SELECT * FROM downloads WHERE id = ?", [numericId]);
    if (!dl) throw new Error("Download not found");
    const existing = activeTasks.get(numericId);
    if (existing) {
      taskStopReasons.delete(numericId);
      killProcessTree(existing.process.pid);
      activeTasks.delete(numericId);
    }
    updateDownloadInDb(numericId, { state: "queued", error: null });
    processQueue();
    return { id: numericId };
  });
  import_electron.ipcMain.handle("cancel-download", async (_, id) => {
    const numericId = Number(id);
    const job = activeTasks.get(numericId);
    if (job) {
      import_electron_log2.default.info("[CANCEL] Cancelling job:", numericId);
      taskStopReasons.set(numericId, "cancelled");
      updateDownloadInDb(numericId, { state: "cancelled" });
      killProcessTree(job.process.pid);
      activeTasks.delete(numericId);
      updatePowerSave();
      try {
        const fileBase = import_path.default.basename(job.outputTemplate, import_path.default.extname(job.outputTemplate));
        if (job.savePath && import_fs3.default.existsSync(job.savePath)) {
          const files = import_fs3.default.readdirSync(job.savePath);
          for (const file of files) {
            if (file.includes(fileBase) && file.endsWith(".part") || file.endsWith(".ytdl")) {
              import_fs3.default.unlinkSync(import_path.default.join(job.savePath, file));
              import_electron_log2.default.info("[CANCEL] Deleted partial file:", file);
            }
          }
        }
      } catch (err) {
        import_electron_log2.default.warn("[CANCEL] Could not clean up partial files:", err);
      }
    }
    const dl = getQuery(db, "SELECT save_path FROM downloads WHERE id = ?", [numericId]);
    if (dl) deletePartialFile(dl.save_path);
    updateDownloadInDb(numericId, { state: "cancelled" });
    if (mainWindow) {
      mainWindow.webContents.send("download-progress", {
        jobId: String(numericId),
        id: numericId,
        percent: 0,
        phase: "Cancelled",
        status: "cancelled"
      });
    }
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });
  import_electron.ipcMain.handle("delete-download", async (_, id) => {
    const job = activeTasks.get(Number(id));
    if (job) {
      taskStopReasons.set(Number(id), "cancelled");
      killProcessTree(job.process.pid);
      activeTasks.delete(Number(id));
      updatePowerSave();
    }
    const dl = getQuery(db, "SELECT save_path, state FROM downloads WHERE id = ?", [id]);
    if (dl && dl.state !== "completed") {
      deletePartialFile(dl.save_path);
    }
    db.run("DELETE FROM downloads WHERE id = ?", [id]);
    saveDatabase(db);
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });
  import_electron.ipcMain.handle("open-file-path", async (_, filePath) => {
    const result = await import_electron.shell.openPath(filePath);
    if (result) {
      throw new Error(`Could not open file: ${result}`);
    }
    return { success: true };
  });
  import_electron.ipcMain.handle("open-folder", async (_, targetPath) => {
    try {
      import_electron_log2.default.info("[Main] open-folder called with:", targetPath);
      if (!targetPath || typeof targetPath !== "string") {
        import_electron_log2.default.warn("[Main] No path provided, opening Downloads folder");
        await import_electron.shell.openPath(import_electron.app.getPath("downloads"));
        return { success: true };
      }
      if (!import_fs3.default.existsSync(targetPath)) {
        import_electron_log2.default.warn("[Main] Path does not exist, opening Downloads folder:", targetPath);
        await import_electron.shell.openPath(import_electron.app.getPath("downloads"));
        return { success: true };
      }
      const stat = import_fs3.default.statSync(targetPath);
      if (stat.isDirectory()) {
        import_electron_log2.default.info("[Main] Opening folder:", targetPath);
        await import_electron.shell.openPath(targetPath);
      } else {
        import_electron_log2.default.info("[Main] Showing item in folder:", targetPath);
        import_electron.shell.showItemInFolder(targetPath);
      }
      return { success: true };
    } catch (error) {
      import_electron_log2.default.error("[Main] Failed to open folder:", error);
      await import_electron.shell.openPath(import_electron.app.getPath("downloads"));
      return { success: true, fallback: true };
    }
  });
  import_electron.ipcMain.handle("choose-save-folder", async () => {
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"]
    });
    if (!result.canceled) {
      return result.filePaths[0];
    }
    return null;
  });
  import_electron.ipcMain.handle("choose-cookies-file", async () => {
    const result = await import_electron.dialog.showOpenDialog(mainWindow, {
      title: "Select browser cookies file",
      properties: ["openFile"],
      filters: [
        { name: "Cookies / text", extensions: ["txt", "cookies"] },
        { name: "All files", extensions: ["*"] }
      ]
    });
    if (!result.canceled && result.filePaths[0]) {
      return result.filePaths[0];
    }
    return null;
  });
  import_electron.ipcMain.handle("check-disk-space", async (_, { path: targetPath, requiredBytes }) => {
    const freeSpace = await getFreeSpace(targetPath || getDefaultSavePath());
    const estimatedBytes = requiredBytes <= 0 || requiredBytes > 10 * 1024 * 1024 * 1024 ? 500 * 1024 * 1024 : requiredBytes;
    const buffer = 100 * 1024 * 1024;
    return {
      isEnough: freeSpace > estimatedBytes + buffer,
      freeSpace,
      required: estimatedBytes + buffer
    };
  });
  import_electron.ipcMain.handle("get-download-history", async () => {
    return allQuery(db, "SELECT * FROM downloads ORDER BY created_at DESC");
  });
  import_electron.ipcMain.handle("clear-history", async (_, type = "all") => {
    if (type === "all") {
      activeTasks.forEach((job) => {
        killProcessTree(job.process.pid);
      });
      activeTasks.clear();
      updatePowerSave();
      db.run("DELETE FROM downloads");
    } else if (type === "completed") {
      db.run("DELETE FROM downloads WHERE state = 'completed'");
    } else if (type === "failed") {
      db.run("DELETE FROM downloads WHERE state = 'failed'");
    }
    saveDatabase(db);
    return { success: true };
  });
  import_electron.ipcMain.handle("get-settings", async () => {
    return getQuery(db, "SELECT * FROM settings WHERE id = 1");
  });
  import_electron.ipcMain.handle("save-settings", async (_, settings) => {
    import_electron_log2.default.info("[IPC] save-settings called with:", settings);
    try {
      const fields = Object.keys(settings).map((k) => {
        const snakeKey = k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
        return `${snakeKey} = ?`;
      }).join(", ");
      const values = Object.values(settings);
      db.run(`UPDATE settings SET ${fields} WHERE id = 1`, values);
      saveDatabase(db);
      return getQuery(db, "SELECT * FROM settings WHERE id = 1");
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] save-settings failed: ${error.message}`);
      throw error;
    }
  });
  import_electron.ipcMain.handle("open-external", async (_, url) => {
    try {
      const allowed = [
        "https://github.com/Isaac-Onyango-Dev",
        "https://isaac-onyango-dev.github.io"
      ];
      if (allowed.some((prefix) => url.startsWith(prefix))) {
        await import_electron.shell.openExternal(url);
        return { success: true };
      } else {
        import_electron_log2.default.warn(`[IPC] Blocked external URL: ${url}`);
        throw new Error("External URL not allowed");
      }
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] open-external failed: ${error.message}`);
      throw error;
    }
  });
  import_electron.ipcMain.handle("get-app-version", async () => {
    return { version: import_electron.app.getVersion() };
  });
  import_electron.ipcMain.handle("reset-settings", async () => {
    const defaultPath = import_electron.app.getPath("downloads").replace(/\\/g, "/");
    db.run(`
      UPDATE settings SET
        theme = 'system',
        max_concurrent_downloads = 3,
        auto_capture = 1,
        file_types = '["mp4","mp3","zip","exe","pdf","jpg","png"]',
        download_path = ?,
        default_quality = 'best',
        default_format = 'mp4',
        detect_playlists = 1,
        playlist_download_mode = 'all',
        create_playlist_folder = 1,
        eula_age_acknowledged = 0,
        cookies_file_path = '',
        close_to_tray = 1
      WHERE id = 1
    `, [defaultPath]);
    saveDatabase(db);
    return getQuery(db, "SELECT * FROM settings WHERE id = 1");
  });
  import_electron.ipcMain.handle("get-default-download-path", () => import_electron.app.getPath("downloads"));
  import_electron.ipcMain.handle("update-ytdlp", async () => {
    try {
      import_electron_log2.default.info("[IPC] Manual update-ytdlp triggered");
      const result = await performYtDlpUpdate();
      return result;
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] update-ytdlp failed: ${error.message}`);
      throw new Error(`Update failed: ${error.message}`);
    }
  });
  import_electron.ipcMain.handle("get-ytdlp-version", async () => {
    return await getCurrentYtDlpVersion();
  });
  import_electron.ipcMain.handle("check-all-binary-updates", async () => {
    try {
      const results = [];
      for (const binary of BINARIES) {
        const installedVersion = await getBinaryVersion(binary);
        const latestVersion = await getLatestBinaryVersion(binary);
        results.push({
          name: binary.name,
          installedVersion,
          latestVersion,
          needsUpdate: installedVersion !== latestVersion,
          downloadUrl: binary.downloadUrl(latestVersion)
        });
      }
      return results;
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] check-all-binary-updates failed: ${error.message}`);
      throw new Error(`Failed to check updates: ${error.message}`);
    }
  });
  import_electron.ipcMain.handle("update-binary", async (_, { binaryName }) => {
    try {
      const binary = BINARIES.find((b) => b.name === binaryName);
      if (!binary) {
        throw new Error(`Unknown binary: ${binaryName}`);
      }
      import_electron_log2.default.info(`[IPC] Updating ${binaryName}...`);
      const result = await performBinaryUpdate(binary);
      return result;
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] update-binary failed for ${binaryName}: ${error.message}`);
      throw new Error(`Update failed: ${error.message}`);
    }
  });
  async function getBinaryVersion(binary) {
    try {
      const userDataBin = import_path.default.join(import_electron.app.getPath("userData"), "binaries", binary.fileName);
      const packagedBin = import_path.default.join(binariesPath, binary.fileName);
      const binaryPath = import_fs3.default.existsSync(userDataBin) ? userDataBin : packagedBin;
      if (!import_fs3.default.existsSync(binaryPath)) {
        return "Not installed";
      }
      const { execSync } = require("child_process");
      const output = execSync(`"${binaryPath}" ${binary.versionFlag}`, { encoding: "utf8" });
      const version = output.split("\n")[0].trim();
      return version;
    } catch (error) {
      import_electron_log2.default.error(`Failed to get version for ${binary.name}: ${error.message}`);
      return "Unknown";
    }
  }
  async function getLatestBinaryVersion(binary) {
    try {
      const release = await fetchJson(binary.releaseApi);
      return release.tag_name;
    } catch (error) {
      import_electron_log2.default.error(`Failed to fetch latest version for ${binary.name}: ${error.message}`);
      return "Unknown";
    }
  }
  async function performBinaryUpdate(binary) {
    try {
      const release = await fetchJson(binary.releaseApi);
      const latestVersion = release.tag_name;
      const downloadUrl = binary.downloadUrl(latestVersion);
      const tempPath = import_path.default.join(import_electron.app.getPath("temp"), `${binary.fileName}.tmp`);
      const userDataBinariesPath = import_path.default.join(import_electron.app.getPath("userData"), "binaries");
      if (!import_fs3.default.existsSync(userDataBinariesPath)) {
        import_fs3.default.mkdirSync(userDataBinariesPath, { recursive: true });
      }
      const destPath = import_path.default.join(userDataBinariesPath, binary.fileName);
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download ${binary.name}: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      import_fs3.default.writeFileSync(tempPath, Buffer.from(buffer));
      if (binary.isZip) {
        const tempDir = import_path.default.join(import_electron.app.getPath("temp"), `${binary.name}_extract`);
        if (!import_fs3.default.existsSync(tempDir)) {
          import_fs3.default.mkdirSync(tempDir, { recursive: true });
        }
        const { execSync } = require("child_process");
        execSync(`powershell -Command "Expand-Archive -Path '${tempPath}' -DestinationPath '${tempDir}'"`, { cwd: import_electron.app.getPath("temp") });
        const extractedFiles = import_fs3.default.readdirSync(tempDir);
        const exeFile = extractedFiles.find((f) => f.endsWith(".exe"));
        if (!exeFile) {
          throw new Error(`Could not find ${binary.fileName} in extracted archive`);
        }
        const finalPath = import_path.default.join(tempDir, exeFile);
        import_fs3.default.copyFileSync(finalPath, destPath);
        import_fs3.default.rmSync(tempDir, { recursive: true, force: true });
      } else {
        import_fs3.default.copyFileSync(tempPath, destPath);
      }
      import_fs3.default.unlinkSync(tempPath);
      import_electron_log2.default.info(`[UPDATE] ${binary.name} successfully updated to ${latestVersion} in userData`);
      return { success: true, newVersion: latestVersion };
    } catch (error) {
      import_electron_log2.default.error(`Failed to update ${binary.name}: ${error.message}`);
      return { success: false, newVersion: "" };
    }
  }
  import_electron.ipcMain.handle("check-ytdlp-version", async () => {
    return await checkYtDlpVersion();
  });
  import_electron.ipcMain.handle("add-playlist-to-queue", async (_, { entries, options }) => {
    import_electron_log2.default.info(`[IPC] add-playlist-to-queue called with ${entries.length} entries`);
    try {
      const settings = getQuery(db, "SELECT * FROM settings WHERE id = 1");
      const baseSavePath = options.savePath || settings?.download_path || settings?.downloadPath;
      const createFolder = options.createFolder ?? true;
      let playlistFolderPath = baseSavePath;
      if (createFolder && options.playlistTitle) {
        const playlistFolderName = options.playlistTitle.replace(/[<>:"/\\|?*]/g, "").trim().slice(0, 100);
        playlistFolderPath = import_path.default.join(baseSavePath, playlistFolderName || "Playlist");
        if (!import_fs3.default.existsSync(playlistFolderPath)) {
          import_fs3.default.mkdirSync(playlistFolderPath, { recursive: true });
        }
      }
      let addedCount = 0;
      for (const entry of entries) {
        try {
          const videoInfo = await extractVideoInfo(entry.url, {
            ytDlp: ytDlpPath,
            ffmpeg: ffmpegPath,
            streamlink: streamlinkPath,
            nm3u8dl: n_m3u8dlPath,
            galleryDl: galleryDlPath,
            cookiesFile: getResolvedCookiesPath()
          });
          const video = Array.isArray(videoInfo) ? videoInfo[0] : videoInfo;
          const prefQuality = settings?.default_quality || "best";
          const prefFormat = settings?.default_format || "mp4";
          let formatId = "bestvideo+bestaudio";
          if (prefFormat === "mp3") {
            formatId = "bestaudio";
          } else if (prefQuality !== "best") {
            const targetQuality = prefQuality + "p";
            const match = video.formats?.find((f) => f.quality === targetQuality);
            formatId = match ? match.formatId : "bestvideo+bestaudio";
          }
          const cleanTitle = entry.title ? entry.title.replace(/[^a-z0-9]/gi, "_").slice(0, 50) : "video";
          const isAudioOnly = formatId === "bestaudio";
          const ext = isAudioOnly ? "mp3" : video.formats?.find((f) => f.formatId === formatId)?.ext || "mp4";
          const filename = createFolder ? `${entry.index.toString().padStart(2, "0")} - ${cleanTitle}.${ext}` : `${cleanTitle}.${ext}`;
          const outputPath = import_path.default.join(playlistFolderPath, filename);
          db.run(`
            INSERT INTO downloads (
              url, filename, format_id, save_path, thumbnail, duration, uploader, 
              state, created_at, playlist_title, playlist_index, playlist_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', datetime('now'), ?, ?, ?)
          `, [
            entry.url,
            filename,
            formatId,
            outputPath,
            entry.thumbnail ?? null,
            video.duration ?? null,
            video.uploader ?? null,
            options.playlistTitle ?? null,
            entry.index,
            entries.length
          ]);
          saveDatabase(db);
          const insertInfo = getQuery(db, "SELECT last_insert_rowid() as id");
          const downloadId = insertInfo.id;
          spawnDownload(downloadId, entry.url, outputPath, formatId, false);
          addedCount++;
        } catch (error) {
          import_electron_log2.default.error(`[IPC Error] Failed to add playlist entry ${entry.index}: ${error.message}`);
        }
      }
      return { success: true, addedCount };
    } catch (error) {
      import_electron_log2.default.error(`[IPC Error] add-playlist-to-queue failed: ${error.message}`);
      throw new Error(`Failed to add playlist to queue: ${error.message}`);
    }
  });
}
var lineBuffers = /* @__PURE__ */ new Map();
function spawnDownload(downloadId, url, outputPath, formatId, isResume = false, youtubePlayerClient) {
  taskStopReasons.delete(downloadId);
  let lastStderrOutput = "";
  let aggregatedStderr = "";
  let actualFilePath = outputPath;
  let cleanedFilePathCandidate = null;
  const formatArg = formatId === "bestvideo+bestaudio" || !formatId ? "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best" : formatId === "bestaudio" ? "bestaudio/best" : `${formatId}+bestaudio/best`;
  const saveFolder = import_path.default.dirname(outputPath);
  const outputTemplate = import_path.default.join(saveFolder, "%(title)s.%(ext)s");
  const cookiesPath = getResolvedCookiesPath();
  const ytDlpArgs = [
    "--newline",
    "--progress",
    "--no-colors",
    "--no-warnings",
    ...ytDlpCommonArgs(url, {
      noPlaylist: true,
      ...youtubePlayerClient !== void 0 ? { youtubePlayerClient } : {}
    }),
    ...ytDlpCookiesArgs(cookiesPath),
    "--windows-filenames",
    "--trim-filenames",
    "200",
    "-f",
    formatArg,
    "--merge-output-format",
    "mp4",
    "--ffmpeg-location",
    ffmpegPath,
    "-o",
    outputTemplate,
    url
  ];
  if (isResume) {
    ytDlpArgs.unshift("--continue");
  }
  import_electron_log2.default.info("[PROGRESS-AUDIT] Download started for jobId:", downloadId);
  import_electron_log2.default.info("[PROGRESS-AUDIT] yt-dlp command:", ytDlpPath, ytDlpArgs.join(" "));
  const ytDlpProcess = (0, import_child_process.spawn)(ytDlpPath, ytDlpArgs);
  activeTasks.set(downloadId, {
    process: ytDlpProcess,
    url,
    formatArg,
    outputTemplate,
    savePath: saveFolder,
    // Helps cleanup/correct open-folder paths if we capture it.
    filePath: actualFilePath
  });
  updatePowerSave();
  const parseYtDlpOutput = (raw, jobId) => {
    const existing = lineBuffers.get(jobId) || "";
    const combined = existing + raw;
    const lines = combined.split(/[\n\r]+/);
    const lastLine = combined.endsWith("\n") || combined.endsWith("\r") ? "" : lines.pop() || "";
    lineBuffers.set(jobId, lastLine);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const progressMatch = trimmed.match(
        /\[download\]\s+([\d.]+)%(?:\s+of\s+(?:~?\s*)?([\w.\s]+?))?(?:(?:\s+in\s+[\w:]+)?\s+at\s+([\w.\s\/]+?))?(?:\s+ETA\s+([\w:]+))?(?:\s+\(frag.*?\))?\s*$/i
      );
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        const totalSizeStr = progressMatch[2] ? progressMatch[2].trim() : "Unknown";
        const speedStr = progressMatch[3] ? progressMatch[3].trim() : "";
        const etaRaw = progressMatch[4] ? progressMatch[4].trim() : "";
        const progressData = {
          jobId: String(jobId),
          id: jobId,
          percent: Math.min(percent, 99),
          totalSize: totalSizeStr,
          speed: speedStr === "Unknown" ? "" : speedStr,
          eta: formatEta(etaRaw),
          phase: "Downloading",
          status: "downloading"
        };
        import_electron_log2.default.info(`[PROGRESS] ${jobId}: ${percent}% of ${totalSizeStr} at ${speedStr} ETA ${etaRaw}`);
        if (mainWindow) {
          mainWindow.webContents.send("download-progress", progressData);
          mainWindow.setProgressBar(progressData.percent / 100);
        }
        const parseSize = (s) => {
          const num = parseFloat(s);
          const su = s.toLowerCase();
          if (su.includes("tib")) return num * 1024 * 1024 * 1024 * 1024;
          if (su.includes("gib")) return num * 1024 * 1024 * 1024;
          if (su.includes("mib")) return num * 1024 * 1024;
          if (su.includes("kib")) return num * 1024;
          return num;
        };
        const totalBytes = parseSize(totalSizeStr);
        const receivedBytes = Math.floor(totalBytes * (progressData.percent / 100));
        updateDownloadInDb(jobId, { totalBytes, receivedBytes });
        continue;
      }
      if (trimmed.startsWith("[download] Destination:")) {
        const rawDestinationPath = trimmed.replace("[download] Destination:", "").trim();
        const dir = import_path.default.dirname(rawDestinationPath);
        const ext = import_path.default.extname(rawDestinationPath);
        const baseName = import_path.default.basename(rawDestinationPath, ext);
        const cleanName = cleanFilename(baseName);
        const cleanPath = import_path.default.join(dir, cleanName + ext);
        cleanedFilePathCandidate = rawDestinationPath !== cleanPath ? cleanPath : null;
        actualFilePath = rawDestinationPath;
        if (rawDestinationPath && cleanedFilePathCandidate && import_fs3.default.existsSync(rawDestinationPath)) {
          try {
            import_fs3.default.renameSync(rawDestinationPath, cleanedFilePathCandidate);
            actualFilePath = cleanedFilePathCandidate;
            const task = activeTasks.get(downloadId);
            if (task) task.filePath = cleanedFilePathCandidate;
          } catch {
          }
        }
        if (mainWindow) {
          mainWindow.webContents.send("download-progress", {
            jobId: String(jobId),
            id: jobId,
            percent: 0,
            phase: "Starting download...",
            status: "downloading"
          });
        }
        continue;
      }
      if (trimmed.includes("has already been downloaded")) {
        if (mainWindow) mainWindow.webContents.send("download-progress", { jobId: String(jobId), id: jobId, percent: 100, phase: "Already downloaded", status: "completed" });
        continue;
      }
      if (trimmed.includes("[Merger]") || trimmed.includes("Merging formats into") || trimmed.includes("[ffmpeg]")) {
        if (mainWindow) mainWindow.webContents.send("download-progress", { jobId: String(jobId), id: jobId, percent: 99, phase: "Merging audio and video...", status: "merging" });
        continue;
      }
      if (trimmed.includes("[ExtractAudio]")) {
        if (mainWindow) mainWindow.webContents.send("download-progress", { jobId: String(jobId), id: jobId, percent: 99, phase: "Extracting audio...", status: "merging" });
        continue;
      }
      if (trimmed.includes("ERROR:") || trimmed.includes("error:") || trimmed.includes("Unable to download") || trimmed.includes("This video is unavailable")) {
        import_electron_log2.default.error(`[PROGRESS] Error for job ${jobId}:`, trimmed);
        const userFriendlyError = translateDownloadError(trimmed, null, url);
        const deferFailForAgeRetry = isYouTubeUrl(url) && youtubePlayerClient !== "tv_embedded" && isLikelyYoutubeAgeRestrictionError(trimmed);
        if (deferFailForAgeRetry) {
          import_electron_log2.default.info(`[PROGRESS] Holding failed state for job ${jobId} pending tv_embedded retry`);
          if (mainWindow) {
            mainWindow.webContents.send("download-progress", {
              jobId: String(jobId),
              id: jobId,
              percent: 0,
              phase: "Retrying with alternate player\u2026",
              status: "downloading"
            });
          }
        } else {
          if (mainWindow) {
            mainWindow.webContents.send("download-progress", {
              jobId: String(jobId),
              id: jobId,
              percent: 0,
              phase: userFriendlyError,
              status: "failed",
              error: userFriendlyError
            });
          }
          updateDownloadInDb(jobId, { state: "failed", error: userFriendlyError });
        }
        continue;
      }
    }
  };
  ytDlpProcess.stdout.on("data", (data) => {
    import_electron_log2.default.info("[PROGRESS-AUDIT] STDOUT received:", data.toString());
    parseYtDlpOutput(data.toString(), downloadId);
  });
  ytDlpProcess.stderr.on("data", (data) => {
    const text = data.toString();
    aggregatedStderr += text;
    import_electron_log2.default.info("[PROGRESS-AUDIT] STDERR received:", text);
    lastStderrOutput = text;
    parseYtDlpOutput(text, downloadId);
  });
  ytDlpProcess.on("close", (code) => {
    import_electron_log2.default.info("[PROGRESS-AUDIT] Process closed with code:", code);
    lineBuffers.delete(downloadId);
    activeTasks.delete(downloadId);
    updatePowerSave();
    const stopReason = taskStopReasons.get(downloadId);
    if (stopReason === "paused" || stopReason === "cancelled") {
      taskStopReasons.delete(downloadId);
      processQueue();
      return;
    }
    try {
      const dlState = getQuery(db, "SELECT state FROM downloads WHERE id = ?", [downloadId]);
      const state = dlState?.state;
      if (state === "paused" || state === "cancelled") {
        processQueue();
        return;
      }
    } catch {
    }
    if (code === 0) {
      import_electron_log2.default.info(`[PROGRESS] Job ${downloadId} completed successfully`);
      if (cleanedFilePathCandidate && import_fs3.default.existsSync(actualFilePath) && cleanedFilePathCandidate !== actualFilePath) {
        try {
          if (!import_fs3.default.existsSync(cleanedFilePathCandidate)) {
            import_fs3.default.renameSync(actualFilePath, cleanedFilePathCandidate);
          }
          actualFilePath = cleanedFilePathCandidate;
          const task = activeTasks.get(downloadId);
          if (task) task.filePath = cleanedFilePathCandidate;
        } catch {
        }
      }
      updateDownloadInDb(downloadId, { state: "completed", completedAt: /* @__PURE__ */ new Date() });
      if (mainWindow) {
        mainWindow.webContents.send("download-progress", {
          jobId: String(downloadId),
          id: downloadId,
          percent: 100,
          phase: "Download complete",
          status: "completed",
          // UI uses `savePath` to open the correct folder.
          savePath: saveFolder,
          filePath: actualFilePath,
          speed: "",
          eta: ""
        });
        mainWindow.setProgressBar(-1);
        try {
          const dl = getQuery(db, "SELECT filename FROM downloads WHERE id = ?", [downloadId]);
          new import_electron.Notification({
            title: "Download Complete",
            body: dl ? dl.filename : "Your file has been saved."
          }).show();
        } catch (_) {
        }
      }
    } else if (code !== null) {
      if (youtubePlayerClient !== "tv_embedded" && isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(aggregatedStderr)) {
        import_electron_log2.default.info(`[PROGRESS] Retrying download ${downloadId} with youtube:player_client=tv_embedded`);
        spawnDownload(downloadId, url, outputPath, formatId, isResume, "tv_embedded");
        processQueue();
        return;
      }
      console.error(`[PROGRESS] Job ${downloadId} failed with code ${code}`);
      const userFriendlyError = translateDownloadError(aggregatedStderr || lastStderrOutput, code, url);
      updateDownloadInDb(downloadId, { state: "failed", error: userFriendlyError });
      if (mainWindow) {
        mainWindow.webContents.send("download-progress", {
          jobId: String(downloadId),
          id: downloadId,
          percent: 0,
          phase: userFriendlyError,
          status: "failed",
          error: userFriendlyError
        });
        mainWindow.setProgressBar(-1);
      }
    }
    processQueue();
  });
  ytDlpProcess.on("error", (err) => {
    activeTasks.delete(downloadId);
    updatePowerSave();
    import_electron_log2.default.error(`[Spawn Error] downloadId=${downloadId}: ${err.message}`);
    const userFriendlyError = translateDownloadError(err?.message || String(err), null, url);
    updateDownloadInDb(downloadId, { state: "failed", error: userFriendlyError });
    if (mainWindow) {
      mainWindow.webContents.send("download-progress", { jobId: String(downloadId), id: downloadId, state: "failed", status: "failed", error: userFriendlyError });
    }
    processQueue();
  });
  return { id: downloadId };
}
function formatEta(eta) {
  if (!eta || eta === "Unknown") return "Calculating...";
  const parts = eta.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h > 0) return `${h}h ${m}m left`;
    if (m > 0) return `${m}m ${s}s left`;
    return `${s}s left`;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (m > 0) return `${m}m ${s}s left`;
    return `${s}s left`;
  }
  return eta;
}
if (import_electron.app) {
  import_electron.app.disableHardwareAcceleration();
  import_electron.app.isQuitting = false;
  import_electron.app.on("before-quit", () => {
    import_electron.app.isQuitting = true;
  });
  import_electron.app.whenReady().then(async () => {
    try {
      if (!initializeSingleInstanceLock()) {
        return;
      }
      import_electron_log2.default.info("[Main] App ready \u2014 startup sequence begin");
      checkBinaries();
      await initDb();
      setupIpcHandlers();
      createWindow();
      createTray();
      processQueue();
      setTimeout(() => runBackgroundVersionCheck(), 5e3);
      try {
        await (0, import_execa2.default)(ytDlpPath, ["--version"], { timeout: 5e3 });
        import_electron_log2.default.info("[Main] yt-dlp pre-warmed successfully");
      } catch (err) {
        import_electron_log2.default.warn("[Main] yt-dlp pre-warm failed:", err?.message || err);
        import_electron_log2.default.warn("[Main] yt-dlp pre-warm stderr:", err?.stderr || "No stderr");
      }
    } catch (err) {
      import_electron_log2.default.error("[Main] Startup error:", err);
      const text = err instanceof Error ? `${err.message}
${err.stack ?? ""}` : String(err);
      try {
        import_electron.dialog.showErrorBox(
          "Internet Download Hub \u2014 startup failed",
          `${text}

Details were written to the log file.`
        );
      } catch {
      }
      import_electron.app.quit();
    }
  }).catch((err) => {
    import_electron_log2.default.error("[Main] app.whenReady() rejected:", err);
    import_electron.app.quit();
  });
}
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !import_electron.app.isQuitting) {
    return;
  }
  import_electron.app.quit();
});
import_electron.app.on("activate", () => {
  if (mainWindow === null) createWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
});
