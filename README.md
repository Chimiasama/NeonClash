# NeonClash

Jogo de cartas cyberpunk em que Kairo explora Baixa Luz, investiga a Vértice e desafia os personagens da cidade.

## Afinidades

Pulso vence Malha, Malha vence Sombra e Sombra vence Pulso. A vantagem dá +1 de dano nos choques normais entre unidades. Uma dupla de Overclock com duas afinidades diferentes ganha +1 contra um bloqueador. Unidades neutras ficam fora desses bônus.

Na Feira do Viaduto, a oficina recalibra as unidades da coleção por 15 créditos e restaura gratuitamente a afinidade original. O Exploit Recompilar custa 1 RAM e muda a afinidade de uma unidade aliada durante o duelo.

## Cidade e investigação

Abra **Bairros** para consultar os dez bairros e viajar aos seus locais. Em **Investigação**, inicie a campanha narrativa e acompanhe os destinos, as provas e as decisões. As conversas voltam à última página lida. O fluxo original da campanha continua acessível enquanto a investigação estiver desativada.

## Planos de expansão

- [Elenco de 100 NPCs e dez bairros](docs/baixa-luz-cidade.md)
- [Roteiro de campanha e ordem de construção](docs/baixa-luz-campanha.md)
- [Plano dos modos e das 500 cartas](docs/plano-expansao.md)

## Desenvolvimento web

Com Node.js 24, execute `npm ci` e `npm run dev`. O jogo salva o progresso no armazenamento local.

Para testar o build em um navegador com tamanho de celular, execute:

```sh
npm run build
npx playwright install chromium
npm test
```

## APK Android

A [Action do Android](https://github.com/Chimiasama/NeonClash/actions/workflows/android.yml) testa o build web a cada push na `main` e disponibiliza o APK de teste em **Artifacts → NeonClash-debug** na execução concluída.

Para gerar o mesmo APK localmente, instale JDK 17, Android SDK 35 e Build Tools 36.0.0 e configure `ANDROID_HOME`:

```sh
npm ci
npm run build
cd android
./gradlew :app:assembleDebug
```

O APK em `android/app/build/outputs/apk/debug/app-debug.apk` é assinado com uma chave de depuração. A WebView carrega os arquivos do próprio APK e mantém o progresso local no dispositivo.
