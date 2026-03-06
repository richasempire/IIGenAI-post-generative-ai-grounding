"use client";

import { useState, useEffect } from "react";

const WORDS = [
  "Envisioning...",
  "Conjuring spaces...",
  "Germinating...",
  "Materializing...",
  "Philosophizing about concrete...",
  "Brewing aesthetics...",
  "Interrogating pixels...",
  "Grounding in reality...",
  "Consulting the carbon oracle...",
  "Deliberating...",
  "Cross-examining materials...",
  "Verifying molecular intentions...",
  "Assembling insights...",
  "Almost there...",
];

export default function PipelineLoader() {
  const [index, setIndex] = useState(0);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setFaded(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % WORDS.length);
        setFaded(false);
      }, 300);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <p
        className="font-mono text-lg text-ghost tracking-wide transition-opacity duration-300"
        style={{ opacity: faded ? 0 : 1 }}
      >
        {WORDS[index]}
      </p>
    </div>
  );
}
