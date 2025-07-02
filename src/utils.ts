export function jsonSafeParse(text: string) {
  if (!text || text.trim() === "") {
    return null;
  }

  const trimmedText = text.trim();
  let jsonStringCandidate: string | null = null;

  const jsonBlockRegex = /```(?:json|js|javascript|text)?\s*([\s\S]*?)\s*```/;
  let match = trimmedText.match(jsonBlockRegex);
  if (match && match[1]) {
    jsonStringCandidate = match[1].trim();
  }

  if (!jsonStringCandidate) {
    const firstBrace = trimmedText.indexOf('{');
    const lastBrace = trimmedText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStringCandidate = trimmedText.substring(firstBrace, lastBrace + 1);

      if (firstBrace > 0 || lastBrace < trimmedText.length - 1) {
        try {
          JSON.parse(jsonStringCandidate);
        } catch (e) {
          jsonStringCandidate = null;
        }
      }
    }
  }

  if (!jsonStringCandidate && trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
    jsonStringCandidate = trimmedText;
  }


  if (jsonStringCandidate) {
    try {
      const parsed = JSON.parse(jsonStringCandidate);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch (error) {
      let repairedJsonCandidate = jsonStringCandidate;
      repairedJsonCandidate = repairedJsonCandidate.replace(/,\s*([\]}])/g, '$1');
      repairedJsonCandidate = repairedJsonCandidate.replace(/'([^']*)'/g, '"$1"');

      try {
        const parsedRepaired = JSON.parse(repairedJsonCandidate);
        if (typeof parsedRepaired === "object" && parsedRepaired !== null) {
          console.warn("Successfully parsed JSON after minor repair.");
          return parsedRepaired;
        }
      } catch (repairError) {
        console.error("Failed to parse extracted JSON string, even after repair:", repairError);
        console.error("Original candidate:", jsonStringCandidate);
        console.error("Repaired candidate (if any):", repairedJsonCandidate);
      }
    }
  }

  return null;
}
