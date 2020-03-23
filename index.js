var fs = require("fs");
var papa = require("papaparse");
var emailValidator = require("email-validator");
var phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();

var nomeArquivoCsv = "./input.csv";

var dadosCsv = [];
var resultado = [];

async function realizarProcessoConversaoCsvParaJson(){
    await lerArquivo();
    await construirArquivoJson();
} 

realizarProcessoConversaoCsvParaJson().then(() => {
    var resultadoFormatado = JSON.stringify(resultado, null, "\t");                
		fs.writeFile("./output.json", resultadoFormatado , function(erro) {
			if (erro) {
				return console.log(erro);
			}
			console.log(resultadoFormatado);
		});
})

function lerArquivo() {
    return new Promise(function(resolve){
        var arquivo = fs.createReadStream(nomeArquivoCsv);
        papa.parse(arquivo, {			
            complete: function(results) {
                var indiceId = results.data[0].indexOf("eid");
                removerLinhasDuplicadas(results.data, indiceId);
                resolve(results.data);
            }
        });
    });		   
}

function removerLinhasDuplicadas(data, indiceId) {
    var ids = [];
    for (linha = 0; linha < data.length; linha++) {
        var idJaAdicionado = ids.some(id => id == data[linha][indiceId]);
        if (idJaAdicionado) {
            var indiceIdJaAdicionado = ids.indexOf(data[linha][indiceId]);
            for (coluna = 0; coluna < data[linha].length; coluna++) {
                if (dadosCsv[0][coluna] != "fullname" && dadosCsv[0][coluna] != "eid") {
                    dadosCsv[indiceIdJaAdicionado][coluna] = dadosCsv[indiceIdJaAdicionado][coluna] + "," + data[linha][coluna];
                }
            }
        } else {
            dadosCsv.push(data[linha]);
            ids.push(data[linha][indiceId]);
        }
    }	
}

function construirArquivoJson() {
    return new Promise(function(resolve) {
        for (linha = 1; linha < dadosCsv.length; linha++) {
            var objeto = {};
            objeto.addresses = [];
            objeto.classes = [];

            for (coluna = 0; coluna < dadosCsv[linha].length; coluna++) {
                tratarDados(dadosCsv, linha, coluna, objeto);
            }

            resultado.push(objeto);
        }
        resolve();
    });
}

function tratarDados(dadosCsv, linha, coluna, objeto){
    var cabecalho = dadosCsv[0][coluna];
    var descricaoLinha = dadosCsv[linha][coluna];

    switch (cabecalho){
        case "eid":
        case "fullname":        
            objeto[cabecalho] = descricaoLinha;
            break;
        case "class":
            adicionarClasse(objeto, descricaoLinha);
            break;
        case "invisible":
        case "see_all":
            objeto[cabecalho] = descricaoLinha.indexOf("yes") >=0  || descricaoLinha.indexOf("1") >= 0;
            break;
        default:
            var cabecalhoArray = cabecalho.split(" ");
            switch (cabecalhoArray[0]){
                case "phone":
                    adicionarTelefone(objeto, cabecalhoArray, descricaoLinha);
                    break;
                case "email":
                    adicionarEmail(objeto, cabecalhoArray, descricaoLinha);
                    break;  
            }
    }
}

function adicionarClasse(objeto, descricaoLinha) {
    if (descricaoLinha){        
        var salasArray = descricaoLinha.split(/,|\//);
        
        salasArray.forEach(function (item) {
            objeto.classes[objeto.classes.length] = item.trim();
            objeto.classes.sort();
        });
    }  
}

function adicionarTelefone(objeto, cabecalhoArray, descricaoLinha) {
    var listaTelefones  = descricaoLinha.split(",");
    listaTelefones.forEach(function (telefone) {
        var telefoneFormatado = formatarNumeroTelefone(telefone)        
		
        if (telefoneFormatado) {           
            var tags = cabecalhoArray.slice(1).map((item) => item);
           
            objeto.addresses.push({
                "type": cabecalhoArray[0],
                "tags": tags,
                "address": telefoneFormatado
            });
        }
    });
}

function formatarNumeroTelefone(telefone){
    var apenasNumero = telefone.replace(/\D/g,"");    

    if (parseInt(apenasNumero)){
        var numeroTelefone = phoneUtil.parseAndKeepRawInput(apenasNumero, "BR");

        if (phoneUtil.isValidNumber(numeroTelefone)) {            	
            return numeroTelefone.getCountryCode().toString() + numeroTelefone.getNationalNumber().toString();           
        }
    }

    return "";
}	

function adicionarEmail(objeto, cabecalhoArray, descricaoLinha) {    
    var emailsArray = descricaoLinha.split(/,|\//);
    emailsArray.forEach(function (email) {
        if (emailValidator.validate(email)) {            
            var tags = [cabecalhoArray[1]]
            if (cabecalhoArray[2]) {
                tags.push(cabecalhoArray[2]);
            }            

            objeto.addresses.push({
                "type": cabecalhoArray[0],
                "tags": tags,
                "address": email
            });
        }
    });
}