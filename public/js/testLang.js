var langList = ["1c", "abnf", "accesslog", "ada", "armasm", "avrasm", "actionscript", "apache", "applescript", "asciidoc", "aspectj", "autohotkey", "autoit", "awk", "axapta", "bash", "basic", "bnf", "brainfuck", "cs", "cpp", "cal", "cos", "cmake", "coq", "csp", "css", "capnproto", "clojure", "coffeescript", "crmsh", "crystal", "d", "dns", "dos", "dart", "delphi", "diff", "django", "dockerfile", "dsconfig", "dts", "dust", "ebnf", "elixir", "elm", "erlang", "excel", "fsharp", "fix", "fortran", "gcode", "gams", "gauss", "gherkin", "go", "golo", "gradle", "groovy", "xml", "http", "haml", "handlebars", "haskell", "haxe", "ini", "inform7", "irpf90", "json", "java", "javascript", "lasso", "less", "ldif", "lisp", "livecodeserver", "livescript", "lua", "makefile", "markdown", "mathematica", "matlab", "maxima", "mel", "mercury", "mizar", "mojolicious", "monkey", "moonscript", "nsis", "nginx", "nimrod", "nix", "ocaml", "objectivec", "glsl", "openscad", "ruleslanguage", "oxygene", "pf", "php", "parser3", "perl", "pony", "powershell", "processing", "prolog", "protobuf", "puppet", "python", "profile", "k", "qml", "r", "rib", "rsl", "graph", "ruby", "rust", "scss", "sql", "p21", "scala", "scheme", "scilab", "smali", "smalltalk", "stan", "stata", "stylus", "subunit", "swift", "tap", "tcl", "tex", "thrift", "tp", "twig", "typescript", "vbnet", "vbscript", "vhdl", "vala", "verilog", "vim", "x86asm", "xl", "xpath", "zephir"]

function highlight() {
	code = document.getElementById("inputCode").value.split("\n")
	console.log(code)
  document.getElementById("codeBlock").innerHTML = ""
	for (var i = 0; i < langList.length; i++) {
    var name = document.createElement('b')
    name.innerHTML = langList[i]
    var codeBlock = document.createElement('code')
    codeBlock.className = langList[i] + " multiple_programs"
    for (var j = 0; j < code.length; j++) {
      codeBlock.innerHTML += code[j] + "\n"
    }
    document.getElementById("codeBlock").appendChild(name)
		document.getElementById("codeBlock").appendChild(codeBlock)
	}
  $('pre code').each(function(i, block) {
    hljs.highlightBlock(block);
  });
}