'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictée vocale via la Web Speech API (gratuite, Chrome/Edge/Android/Safari).
 * Repli : si le navigateur ne la supporte pas, on invite l'artisan à taper
 * sa description (la transcription API de secours arrive en finition, phase 7).
 *
 * Les erreurs sont traduites en messages clairs : « micro bloqué », « aucune voix
 * détectée », « pas de connexion »… au lieu d'un message générique.
 */

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
}
interface RecognitionErrorEvent {
  error?: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function messageForError(code: string | undefined): string | null {
  switch (code) {
    case 'aborted':
      return null; // arrêt volontaire : pas d'erreur à afficher
    case 'not-allowed':
    case 'service-not-allowed':
      return (
        'Le micro est bloqué. Cliquez sur le cadenas à côté de l’adresse du site, ' +
        'autorisez le micro, puis réessayez.'
      );
    case 'no-speech':
      return 'Aucune voix détectée. Rapprochez-vous du micro et réessayez.';
    case 'audio-capture':
      return 'Aucun micro détecté sur cet appareil. Branchez-en un ou tapez votre description.';
    case 'network':
      return (
        'La dictée a besoin d’internet et n’est pas disponible sur ce navigateur ou ' +
        'cette connexion. Essayez avec Chrome ou Edge, ou tapez votre description.'
      );
    case 'language-not-supported':
      return 'La dictée en français n’est pas disponible sur ce navigateur. Tapez votre description.';
    default:
      return 'La dictée s’est interrompue. Réessayez ou tapez votre description.';
  }
}

export function useDictation(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const callbackRef = useRef(onFinalText);
  callbackRef.current = onFinalText;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggle = useCallback(() => {
    setError(null);
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
      }
      if (finalChunk) callbackRef.current(finalChunk);
    };
    recognition.onerror = (e) => {
      const message = messageForError(e?.error);
      if (message) setError(message);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() peut lever une exception si une session est déjà en cours
      setError('La dictée n’a pas pu démarrer. Réessayez dans un instant.');
      setListening(false);
    }
  }, [listening]);

  return { listening, supported, error, toggle };
}
