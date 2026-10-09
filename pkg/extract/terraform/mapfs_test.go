package terraform

import (
	"io/fs"
	"testing/fstest"
)

// mapFS builds an in-memory file system from path -> content.
type mapFS map[string]string

func (m mapFS) Open(name string) (fs.File, error) {
	fsys := fstest.MapFS{}
	for p, c := range m {
		fsys[p] = &fstest.MapFile{Data: []byte(c)}
	}
	return fsys.Open(name)
}
