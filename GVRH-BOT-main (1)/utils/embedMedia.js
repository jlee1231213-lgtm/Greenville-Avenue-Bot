function normalizeEmbedMediaUrl(url) {
  if (typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return null;
    }

    if (parsedUrl.hostname === 'media.discordapp.net') {
      parsedUrl.hostname = 'cdn.discordapp.com';
      parsedUrl.searchParams.delete('width');
      parsedUrl.searchParams.delete('height');
      parsedUrl.searchParams.delete('quality');
      parsedUrl.searchParams.delete('format');

      if (parsedUrl.pathname.includes('/attachments/')) {
        parsedUrl.search = '';
      }
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function setEmbedMedia(embed, media = {}) {
  const imageUrl = normalizeEmbedMediaUrl(media.image);
  const thumbnailUrl = normalizeEmbedMediaUrl(media.thumbnail);

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  if (thumbnailUrl) {
    embed.setThumbnail(thumbnailUrl);
  }

  return embed;
}

module.exports = {
  normalizeEmbedMediaUrl,
  setEmbedMedia,
};