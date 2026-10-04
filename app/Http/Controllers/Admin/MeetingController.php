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
        $data = $request->validate(['meeting_mode' => ['required', 'boolean']]);
        $model = Course::query()->findOrFail($course);
        $model->forceFill(['meeting_mode' => (bool) $data['meeting_mode']])->save();

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
            'invite_token' => $model->invite_token,
        ]]);
    }
}