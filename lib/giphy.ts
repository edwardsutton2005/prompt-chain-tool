type GiphyResponse = { data?: Array<{ id?: string }> };

export async function findGif(query: string) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) throw new Error("GIPHY_API_KEY is not configured.");
  const params = new URLSearchParams({
    api_key: apiKey,
    q: query.slice(0, 100),
    limit: "1",
    rating: "pg-13",
    lang: "en",
  });
  const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
  if (!response.ok) throw new Error(`Giphy returned HTTP ${response.status}.`);
  const body = (await response.json()) as GiphyResponse;
  const id = body.data?.[0]?.id;
  if (!id || !/^[A-Za-z0-9]{1,64}$/.test(id)) throw new Error("Giphy returned no matching media.");
  return { id, url: `https://media.giphy.com/media/${id}/giphy.gif` };
}
