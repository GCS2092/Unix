<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $name }} | {{ config('app.name') }}</title>
    <meta name="description" content="{{ $description }}">
    <link rel="canonical" href="{{ $target }}">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="{{ config('app.name') }}">
    <meta property="og:title" content="{{ $name }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ $shareUrl }}">
    @if ($image)
    <meta property="og:image" content="{{ $image }}">
    <meta name="twitter:card" content="summary_large_image">
    @endif
</head>
<body>
    <p><a href="{{ $target }}">{{ $name }}</a></p>
    <script>window.location.replace(@json($target));</script>
</body>
</html>