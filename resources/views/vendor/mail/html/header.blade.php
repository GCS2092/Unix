@props(['url'])
@php $brandSpace = \App\Support\Brand::consume(); @endphp
<tr>
<td class="header" style="padding: 24px 0; text-align: center;">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none; font-size: 24px; font-weight: bold; color: {{ \App\Support\Brand::color($brandSpace) }};">
<img src="{{ \App\Support\Brand::logoUrl($brandSpace) }}" alt="{{ \App\Support\Brand::name($brandSpace) }}" height="56" style="height: 56px; width: auto; max-width: 240px; border: 0; display: block; margin: 0 auto;">
</a>
</td>
</tr>