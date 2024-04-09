import { startDictation, stopDictation, restartDictation } from "./dictation";
import { startCamera, stopCamera } from "./camera";
import { scaleAndStackImagesAndGetBase64 } from "./imageStacker";
import { makeGeminiRequest } from "./gemini";
import { Speech } from "./speech";
import { buildLanguageSelect } from "./dictationLanguages";

const IMAGE_STACK_SIZE = 3;

let isDictating = false;
let imageStack: HTMLImageElement[] = [];
let imageStackInterval: number | null = null;

let unsentMessages: string[] = [];
let openAiCallInTransit = false;
let newMessagesWatcherInterval: number | null = null;
let speech: Speech = new Speech();

export function getChosenLanguage() {
  return document.querySelector("#languageSelect")!.value;
}

function getSliderAIValue() {
  return "gemini";
}

function getApiKey() {
  const providedApiKey = document.querySelector(
    "input[type='password']#apiKey"
  )!.value;

  if (providedApiKey) {
    return providedApiKey;
  }
  // else{
  //   alert("Plese enter API Key");
  // }
  return import.meta.env.VITE_GEMINI_KEY;
}

function pushNewImageOnStack() {
  const canvas = document.querySelector("canvas")! as HTMLCanvasElement;
  const base64 = canvas.toDataURL("image/jpeg");
  const image = document.createElement("img");
  image.src = base64;

  imageStack.push(image);
  if (imageStack.length > IMAGE_STACK_SIZE) {
    imageStack.shift();
  }
}

function dictationEventHandler(message?: string) {
  if (message) {
    unsentMessages.push(message);
    updatePromptOutput(message);
  }

  if (!openAiCallInTransit) {
    openAiCallInTransit = true;
    const base64 = scaleAndStackImagesAndGetBase64(imageStack);
    const textPrompt = unsentMessages.join(" ");
    unsentMessages = [];

    let aiFunction = null;
    aiFunction =
      getSliderAIValue() === "gemini" ? makeGeminiRequest : makeGeminiRequest;

    aiFunction(textPrompt, base64, getApiKey(), speech).then(() => {
      // after speech
      restartDictation();
      openAiCallInTransit = false;
    });
  }
}

export function updatePromptOutput(
  newMessage: string
) {
  const promptOutput = document.getElementById("promptOutput");
  if (!promptOutput) {
    return;
  }
  // Determine the sender prefix
  const sender = promptOutput.children.length % 2 === 0 ? "YOU" : "Blind'sVision";
  const senderClass = promptOutput.children.length % 2 === 0 ? "YOU" : "AI";

  // Construct the message with the sender prefix
  const messageWithPrefix = `${sender}:${newMessage}`;

  // Create a new message element
  const messageElement = document.createElement("div");
  messageElement.textContent = messageWithPrefix;
  messageElement.classList.add("chat-message", senderClass.toLowerCase());

  // Append the message element to the prompt output
  promptOutput.appendChild(messageElement);

  // Add a line break if necessary
  // if (!dontAddNewLine) {
  //   promptOutput.appendChild(document.createElement("br"));
  // }

  // Auto-scroll to bottom
  promptOutput.scrollTop = promptOutput.scrollHeight;
}

// after AI call in transit is done, if we have
// some messages in the unsent queue, we should make another openai call.
function newMessagesWatcher() {
  if (!openAiCallInTransit && unsentMessages.length > 0) {
    dictationEventHandler();
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  buildLanguageSelect();

  document
    .querySelector("#startButton")!
    .addEventListener("click", function () {
      if (!isDictating && !getApiKey()) {
        alert("Please enter an API key.");
        return;
      }

      isDictating = !isDictating;

      if (isDictating) {
        startCamera();
        startDictation(getChosenLanguage(), dictationEventHandler);

        imageStackInterval = window.setInterval(() => {
          pushNewImageOnStack();
        }, 800);

        newMessagesWatcherInterval = window.setInterval(() => {
          newMessagesWatcher();
        }, 100);

        document.querySelector("#startButton")!.textContent = "Stop";
      } else {
        stopCamera();
        stopDictation();

        imageStackInterval && clearInterval(imageStackInterval);
        newMessagesWatcherInterval && clearInterval(newMessagesWatcherInterval);

        document.querySelector("#startButton")!.textContent = "Start";
      }
    });
});
