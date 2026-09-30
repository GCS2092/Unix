export interface Course {
  id: number
  title: string
  slug: string
  description: string | null
  price: number
  stream_video_id?: string
  livekit_room?: string
  is_published?: boolean
  created_at: string
  updated_at: string
}

export interface Certificate {
  id: number
  file_path: string
  issued_at: string
  download_url?: string
}

export interface Enrollment {
  id: number
  progress: number
  completed_at: string | null
  course?: Course
  certificate?: Certificate | null
  created_at: string
  updated_at: string
}

export interface CoursePlayback {
  course_id: number
  playback: { embed_url: string; expires_at: number }
}
