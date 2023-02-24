import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { Readable, Transform } from 'node:stream'
import { TransformStream, WritableStream } from 'node:stream/web'
import { setTimeout } from 'node:timers/promises'

import csvtojson from 'csvtojson'
const PORT = 3000


createServer(async (request, response) => {
  const headers = {
    'Access-Control-Allow-Origin': "*",
    "Access-Control-Allow-Methods": "*"
  }


  if(request.method === 'OPTIONS'){
    response.writeHead(201, headers)
    response.end()
    return
  }

  let items = 0
  const abortController = new AbortController()
  request.once('close', _ => {
    console.log(`Connection was closed`, items)
    abortController.abort()
  })

  try {
    response.writeHead(200, headers)
    await Readable.toWeb(createReadStream('./animeflv.csv'))

      // pipeThrough é o passo a passo que cada item do meu arquivo, vai trafegar
      // aqui não tem limitação, pode-se passar quantos pipeThroth forem necessários.
      /* 
      Observação: streams são lidadas linha a linha, uma vez que não é mais necessário manter a linha em questão
      na memória, essa linha é removida da memória e assim o app vai para a próxima linha
      */
      // Nessa linha, o Transform pega os dados do csv e com a função csvtojson(), transforma essa infos em ndjson
      // que é um json divido em linhas. O ndjson divide os objetos por linha, sem haver a necessidade de se criar um array 
      .pipeThrough(Transform.toWeb(csvtojson())) 
      .pipeThrough(new TransformStream({
        transform(chunk, controller){
          const data = JSON.parse(Buffer.from(chunk)) // convertendo o chunk de Uint8 para string
          const mappedData = {
            title: data.title,
            description: data.description,
            url_anime: data.url_anime
          }

          controller.enqueue(JSON.stringify(mappedData).concat('\n'))
        }
      }))

      // pipeTo é pra última etapa do meu passo a passo de conversão do csv para json
      // para que assim o front possa ler o que tá sendo enviado
      .pipeTo(new WritableStream({
        async write(chunk){
          await setTimeout(200)
          items++
          response.write(chunk)
        },
        close(){
          response.end()
        }
    }),{ signal: abortController.signal})

  } catch (error) {
    if(!error.message.includes('abort')) throw error
  }

})
.listen(PORT)
.on('listen', _ => console.log(`Server is runnig at ${PORT}`))