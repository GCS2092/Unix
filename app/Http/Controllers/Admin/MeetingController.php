<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MeetingController extends Controller
{
    public function show(int $course): JsonResponse
    {
        $model = Course::query()->findOrFail($course);

        if ($model->invite_token === null) {
            $model->forceFill(['invite_token' => Str::random(40)])->save();
        }

        return $this->payload($model);
    }

    public function update(Request $request, int $course): JsonResponse
    {
        $data = $request->validate([
            'meeting_mode' => ['sometimes', 'boolean'],
            'require_admission' => ['sometimes', 'boolean'],
        ]);

        $model = Course::query()->findOrFail($course);

        $fill = [];
        if (array_key_exists('meeting_mode', $data)) {
            $fill['meeting_mode'] = (bool) $data['meeting_mode'];
        }
        if (array_key_exists('require_admission', $data)) {
            $fill['require_admission'] = (bool) $data['require_admission'];
        }
        if ($fill !== []) {
            $model->forceFill($fill)->save();
        }

        return $this->payload($model);
    }

    public function regenerate(int $course): JsonResponse
    {
        $model = Course::query()->findOrFail($course);
        $model->forceFill(['invite_token' => Str::random(40)])->save();

        return $this->payload($model);
    }

    private function payload(Course $model): JsonResponse
    {
        return response()->json(['data' => [
            'meeting_mode' => (bool) $model->meeting_mode,
            'require_admission' => (bool) $model->require_admission,
            'invite_token' => $model->invite_token,
        ]]);
    }
}