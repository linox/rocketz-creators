import type { ContentReactionChoice } from "@/lib/alerts";

export function reactionPayload(stage: "script" | "video", reaction: ContentReactionChoice) {
  if (stage === "script") {
    return {
      script_liked: reaction.liked,
      script_reaction: reaction.message,
    };
  }

  return {
    video_liked: reaction.liked,
    video_reaction: reaction.message,
  };
}
