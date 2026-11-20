Espaço reservado para arquivos de áudio customizados (.mp3 / .ogg / .wav).
No Android Studio, copie esta pasta para: app/src/main/assets/audio/

Por padrão, o jogo utiliza o sintetizador procedural 100% Web Audio API em js/audio/soundEngine.js.
Quando quiser adicionar músicas ou efeitos gravados, basta salvar os arquivos aqui e referenciá-los via ./audio/<arquivo>.ogg no soundEngine.js.
