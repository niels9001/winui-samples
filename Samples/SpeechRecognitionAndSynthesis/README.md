# Speech Recognition and Synthesis

Ported to WinUI 3 / Windows App SDK from the UWP
[SpeechRecognitionAndSynthesis](https://github.com/microsoft/Windows-universal-samples/tree/main/Samples/SpeechRecognitionAndSynthesis)
sample.

## What it shows

The sample retains all 11 upstream scenarios:

1. Synthesize text.
2. Synthesize text with word and sentence boundaries.
3. Synthesize SSML and receive bookmark events.
4. Recognize one-shot dictation with and without the system UI.
5. Recognize one-shot web searches with and without the system UI.
6. Recognize localized list constraints.
7. Recognize packaged SRGS constraints and semantic values.
8. Run continuous dictation with progressing hypotheses.
9. Run continuous localized list commands.
10. Run continuous SRGS commands.
11. Pause continuous recognition to change and recompile the active grammar.

## APIs featured

- `Windows.Media.SpeechSynthesis.SpeechSynthesizer`
- `Windows.Media.SpeechRecognition.SpeechRecognizer`
- `SpeechRecognitionTopicConstraint`
- `SpeechRecognitionListConstraint`
- `SpeechRecognitionGrammarFileConstraint`
- `SpeechContinuousRecognitionSession`
- `Microsoft.UI.Xaml.Controls.MediaPlayerElement`
- `Windows.Media.Playback.MediaPlaybackItem`
- `Microsoft.Windows.ApplicationModel.Resources.ResourceManager`

## Learn docs this serves

- [Speech recognition](https://learn.microsoft.com/windows/apps/design/input/speech-recognition)
- [Speech synthesis](https://learn.microsoft.com/uwp/api/windows.media.speechsynthesis)
- [Speech recognition constraints](https://learn.microsoft.com/uwp/api/windows.media.speechrecognition)

## Prerequisites and capabilities

- Recognition scenarios require a microphone. Dictation and web-search constraints also
  require internet access and accepted Windows online-speech privacy settings.
- List and SRGS scenarios require an installed speech language pack matching one of the
  localized resources or packaged grammars. Synthesis requires an installed system voice,
  audio output, and Windows media components.
- The package declares `internetClient`, the device capability `microphone`, the restricted
  capabilities `runFullTrust` and `systemAIModels`. The scenarios use
  `Windows.Media.SpeechRecognition` and `Windows.Media.SpeechSynthesis`; they do not directly
  call a System AI Models API.

## Build & run

```powershell
dotnet build -c Debug -p:Platform=x64
dotnet run -c Debug -p:Platform=x64
```

## Migration notes

- `MediaElement` was replaced by `MediaPlayerElement` and `MediaPlayer`.
- `CoreDispatcher` was replaced by `DispatcherQueue`.
- View-scoped UWP resource contexts were replaced by MRT Core resource contexts.
- The original localized speech strings and SRGS grammar files are packaged with the app.
- The WinUI app requests microphone access through an audio-only `MediaCapture` before
  creating recognizers.
- Recognition state, permission failures, missing language packs, and media failures are
  surfaced through the shell `InfoBar`.

## Known differences / limitations

- Dictation, web-search recognition, and continuous dictation require internet access and
  accepted Windows online-speech privacy settings.
- List and SRGS grammars can run offline, but require an installed speech language pack.
- Speech synthesis requires an installed system voice and Windows media components.
- `RecognizeWithUIAsync` displays Windows-owned recognition UI. The platform does not expose
  an HWND initialization contract for parenting that overlay to the WinUI window.
