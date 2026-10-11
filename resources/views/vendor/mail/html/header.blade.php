@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block; font-size: 24px; font-weight: bold; color: #16a34a; text-decoration: none;">
{{ trim($slot) }}
</a>
</td>
</tr>