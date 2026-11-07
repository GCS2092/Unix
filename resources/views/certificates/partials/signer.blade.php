@if (! empty($s['img']))
    @php [$iw, $ih] = $fit($s['img'], 55, 14); @endphp
    <img src="{{ $s['img'] }}" alt="" style="width: {{ $iw }}mm; height: {{ $ih }}mm;">
@else
    <div style="height: 14mm;"></div>
@endif
<div class="sig-line">
    @if (! empty($s['name']))<div class="val" style="margin-top:0">{{ $s['name'] }}</div>@endif
    <div class="lbl">{{ ! empty($s['title']) ? $s['title'] : 'Signature' }}</div>
</div>